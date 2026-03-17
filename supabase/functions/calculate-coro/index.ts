// Tells VS Code to stop looking for Deno configurations and accept it globally
declare const Deno: any;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const requestData = await req.json();
    const inputs = requestData.inputs || {};
    const config = requestData.config || {};

    const reqW = parseFloat(inputs.w) || 24;
    const reqH = parseFloat(inputs.h) || 24;
    const qty = parseFloat(inputs.qty) || 1;
    const reqSides = inputs.sides === 2 ? 2 : 1;
    const thk = String(inputs.thickness || '4mm');
    const actualSqFt = (reqW * reqH) / 144;
    const totalActualSqFt = actualSqFt * qty;

    // --- 1. RETAIL ENGINE (STRICT MATRIX LOOKUP) ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    let matrixPrice = 0; 
    let mappedBox = "";

    if (supabaseUrl && supabaseKey) {
        // Fetch all standard prices for this material and thickness
        const pQuery = thk.includes('10') ? '*10mm*Coro*' : '*4mm*Coro*';
        const res = await fetch(`${supabaseUrl}/rest/v1/retail_fixed_prices?product_line=ilike.${pQuery}&select=*`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        
        if (res.ok) {
            const fixedPrices = await res.json();
            
            // Use Infinity so any found area is smaller
            let bestArea = Infinity; 
            let selectedRow: any = null;
            
            for (const row of fixedPrices) {
                if (!row.dimensions || !row.dimensions.includes('x')) continue;
                
                // Parse standard sizes (e.g., "18x24")
                const parts = row.dimensions.toLowerCase().split('x');
                const sw = parseFloat(parts); 
                const sh = parseFloat(parts[1]); 

                // Check both orientations (Portrait vs Landscape)
                const fitsStandard = (sw >= reqW && sh >= reqH);
                const fitsRotated = (sh >= reqW && sw >= reqH);
                
                if (fitsStandard || fitsRotated) {
                    const area = sw * sh;
                    // We want the smallest standard sign that fits the request
                    if (area < bestArea) {
                        bestArea = area; 
                        selectedRow = row;
                    }
                }
            }
            
            if (selectedRow) {
                mappedBox = selectedRow.dimensions;
                const sidesStr = reqSides === 2 ? 'Double' : 'Single';
                
                // Find the exact pricing row for this specific box and sides combination
                let match = fixedPrices.find((r: any) => r.dimensions === mappedBox && r.sides === sidesStr);

                if (match) {
                    matrixPrice = parseFloat(match.price_qty_1 || "0");
                    let bulk = match.price_qty_10; 
                    if (qty >= 10 && bulk) matrixPrice = parseFloat(bulk);
                    else if (qty >= 10) matrixPrice *= 0.95; // 5% standard fallback discount
                } else {
                    // If Double-Sided isn't listed, find Single-Sided and calculate it
                    let single = fixedPrices.find((r: any) => r.dimensions === mappedBox && r.sides === 'Single');
                    if (single) {
                        let base = parseFloat(single.price_qty_1 || "0");
                        let bulk = single.price_qty_10;
                        if (qty >= 10 && bulk) base = parseFloat(bulk);
                        else if (qty >= 10) base *= 0.95;
                        matrixPrice = reqSides === 2 ? base * (1 + parseFloat(config.Retail_Adder_DS_Mult || "0.5")) : base;
                    }
                }
            }
        }
    }

    const ret: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let unitPrintTotal = 0;
    if (matrixPrice > 0) {
        unitPrintTotal = matrixPrice * qty;
        // Pipe the exact Matrix Lookup hit to the UI Ledger
        R(`Sign Print (${thk} Rounded to ${mappedBox})`, unitPrintTotal, `${qty}x Signs @ $${matrixPrice.toFixed(2)}/ea (Matrix Lookup)`);
    } else {
        // --- 2. FALLBACK ENGINE (Only triggers if size is LARGER than any standard box) ---
        const billedW = Math.ceil(reqW / 12) * 12;
        const billedH = Math.ceil(reqH / 12) * 12;
        const billedSqFt = (billedW * billedH) / 144;
        let baseRate = 0;
        if (thk === '4mm') {
            if (billedSqFt < 4) baseRate = parseFloat(config.COR4_T1_Rate || "8.33");
            else if (billedSqFt === 4) baseRate = 8.00;
            else if (billedSqFt <= 15.99) baseRate = parseFloat(config.COR4_T2_Rate || "7");
            else if (billedSqFt <= 31.99) baseRate = parseFloat(config.COR4_T3_Rate || "6");
            else baseRate = parseFloat(config.COR4_T4_Rate || "5");
        } else {
            if (billedSqFt < 4) baseRate = parseFloat(config.COR10_T1_Rate || "25");
            else if (billedSqFt === 4) baseRate = 24.00;
            else if (billedSqFt <= 15.99) baseRate = parseFloat(config.COR10_T2_Rate || "21");
            else if (billedSqFt <= 31.99) baseRate = parseFloat(config.COR10_T3_Rate || "18");
            else baseRate = parseFloat(config.COR10_T4_Rate || "15");
        }
        let rawUnitPrint = baseRate * billedSqFt;
        let rawUnitDS = reqSides === 2 ? rawUnitPrint * parseFloat(config.Retail_Adder_DS_Mult || "0.5") : 0;
        let combinedUnit = rawUnitPrint + rawUnitDS;
        const minSignPrice = thk === '4mm' ? parseFloat(config.COR4_T1_Min || "25") : parseFloat(config.COR10_T1_Min || "75");

        if (combinedUnit < minSignPrice) {
            unitPrintTotal = minSignPrice * qty;
            R(`Sign Print (${thk} Billed at ${billedW}"x${billedH}")`, unitPrintTotal, `${qty}x Signs @ $${minSignPrice.toFixed(2)} (Unit Min Applied)`);
        } else {
            unitPrintTotal = combinedUnit * qty;
            R(`Base Print (${thk} Billed at ${billedW}"x${billedH}")`, rawUnitPrint * qty, `${qty}x Signs (${billedSqFt} SF) @ $${baseRate.toFixed(2)}/sf`);
            if (reqSides === 2) R(`Double Sided Adder`, rawUnitDS * qty, `+50% Base Rate`);
        }
    }

    // --- RETAIL ADD ONS ---
    let lamTotal = 0;
    if (inputs.laminate && inputs.laminate !== 'None') {
        const lamAdder = parseFloat(config.Retail_Price_Gloss || "8");
        lamTotal = (lamAdder * actualSqFt) * qty;
        R(`Laminate Finish`, lamTotal, `${qty}x Lam @ $${lamAdder}/sf`);
    }

    let routerFee = 0;
    if (inputs.shape !== 'Rectangle') {
        routerFee = inputs.shape === 'CNC Simple' ? parseFloat(config.Retail_Fee_Router_Easy || "30") : parseFloat(config.Retail_Fee_Router_Hard || "50");
        R(`CNC Router Fee`, routerFee, `Flat Shape Routing Fee`);
    }

    if (inputs.hasStakes) {
        const stakeRetail = parseFloat(config.Retail_Stake_Std || "2.50");
        R(`Hardware (H-Stakes)`, stakeRetail * qty, `${qty}x Stakes @ $${stakeRetail.toFixed(2)}/ea`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "50");
    let isMinApplied = false; let grandTotal = grandTotalRaw;

    // Execute Global Shop Minimum Gate
    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Minimum order difference`);
        grandTotal = minOrder; isMinApplied = true;
    }

    const printTotal = unitPrintTotal + lamTotal;

    // --- 3. COST ENGINE (PHYSICS & BOM) ---
    // (Physical calculation engine remains entirely untouched)
    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };
    const sheetCost = thk === '10mm' ? parseFloat(config.Cost_Stock_10mm_4x8 || "33.49") : parseFloat(config.Cost_Stock_4mm_4x8 || "8.40");
    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    const riskFactor = parseFloat(config.Factor_Risk || "1.05");
    const rateOp = parseFloat(config.Rate_Operator || "25");
    const rateShop = parseFloat(config.Rate_Shop_Labor || "20");

    const yieldX = Math.floor(48 / reqW) * Math.floor(96 / reqH);
    const yieldY = Math.floor(48 / reqH) * Math.floor(96 / reqW);
    const bestYield = Math.max(yieldX, yieldY, 1);
    const rawBlanks = (qty / bestYield) * sheetCost;

    L(`Coroplast Blanks (${thk})`, rawBlanks, `${qty} Qty / ${bestYield} Yield * $${sheetCost.toFixed(2)}/Sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);
    L(`Flatbed Ink`, totalActualSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * reqSides, `${totalActualSqFt.toFixed(1)} Actual SF * $0.16/SF * ${reqSides} Sides`);

    const printHrs = ((reqH / 12) * qty / parseFloat(config.Machine_Speed_LF_Hr || "25")) * reqSides;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(config.Labor_Attendance_Ratio || "0.10"), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(config.Rate_Machine_Flatbed || "10"), `${printHrs.toFixed(2)} Hrs * $10/hr`);
    L(`Job Setup (File RIP)`, (parseFloat(config.Time_Setup_Job || "15") / 60) * rateOp, `15 Mins * $${rateOp}/hr`);

    if (inputs.shape !== 'Rectangle') {
        const cncTime = inputs.shape === 'CNC Simple' ? parseFloat(config.Time_CNC_Easy_SqFt || "1") : parseFloat(config.Time_CNC_Complex_SqFt || "2");
        const cutHrs = (totalActualSqFt * cncTime) / 60;
        const cncSetup = parseFloat(config.Time_Setup_CNC || "10");
        L(`CNC Router Setup`, (cncSetup / 60) * parseFloat(config.Rate_CNC_Labor || "25"), `${cncSetup} Mins * $25/hr`);
        L(`CNC Router Run`, cutHrs * parseFloat(config.Rate_Machine_CNC || "10"), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(config.Rate_CNC_Labor || "25"), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
    } else {
        const shearSetup = parseFloat(config.Time_Shear_Setup || "5");
        L(`Shear Machine Setup`, (shearSetup / 60) * rateShop, `${shearSetup} Mins * $${rateShop}/hr`);
        const shearCuts = qty * 4;
        L(`Shear Per-Cut Run`, (shearCuts * parseFloat(config.Time_Shear_Cut || "1") / 60) * rateShop, `${shearCuts} Cuts * 1 Min * $${rateShop}/hr`);
    }

    if (inputs.hasStakes) {
        const stakeCost = parseFloat(config.Cost_Stake_Std || "0.65");
        L(`H-Stakes`, qty * stakeCost, `${qty} Stakes * $${stakeCost.toFixed(2)}`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;
    const payload = { retail: { unitPrice: grandTotal / qty, grandTotal, breakdown: ret, isMinApplied, printTotal, routerFee }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders }) }
})