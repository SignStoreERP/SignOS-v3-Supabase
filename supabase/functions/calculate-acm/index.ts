declare const Deno: any;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const requestData = await req.json();
    const inputs = requestData.inputs || {};
    const config = requestData.config || {};

    const actualSqFt = (inputs.w * inputs.h) / 144;
    const totalActualSqFt = actualSqFt * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;

    // BILLED BRACKET LOGIC
    const getBracket = (val: number) => {
        const brackets = [1-15];
        for (let b of brackets) { if (val <= b) return b; }
        return Math.ceil(val / 12) * 12;
    };
    const billedW = getBracket(inputs.w);
    const billedH = getBracket(inputs.h);
    const billedSqFt = (billedW * billedH) / 144;
    const totalBilledSqFt = billedSqFt * inputs.qty;

    const ret: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRate = 0;
    if (inputs.thickness === '6mm') {
        if (billedSqFt < 3) baseRate = parseFloat(config.ACM6_T1_Rate || "35.33");
        else if (billedSqFt < 6) baseRate = parseFloat(config.ACM6_T2_Rate || "20.50");
        else if (billedSqFt < 12) baseRate = parseFloat(config.ACM6_T3_Rate || "18.50");
        else if (billedSqFt < 32) baseRate = parseFloat(config.ACM6_T4_Rate || "17.50");
        else baseRate = parseFloat(config.ACM6_T5_Rate || "16.50");
    } else {
        if (billedSqFt < 3) baseRate = parseFloat(config.ACM3_T1_Rate || "24.00");
        else if (billedSqFt < 6) baseRate = parseFloat(config.ACM3_T2_Rate || "18.00");
        else if (billedSqFt < 12) baseRate = parseFloat(config.ACM3_T3_Rate || "16.00");
        else if (billedSqFt < 32) baseRate = parseFloat(config.ACM3_T4_Rate || "15.00");
        else baseRate = parseFloat(config.ACM3_T5_Rate || "14.00");
    }

    if (inputs.color === 'Black') baseRate *= 2;

    let rawUnitPrint = baseRate * billedSqFt;
    let rawUnitDS = inputs.sides === 2 ? rawUnitPrint * parseFloat(config.Retail_Adder_DS_Mult || "0.5") : 0;
    let combinedUnit = rawUnitPrint + rawUnitDS;
    
    const minSignPrice = inputs.thickness === '6mm' ? parseFloat(config.ACM6_T1_Min || "26.50") : parseFloat(config.ACM3_T1_Min || "25");
    let unitPrintTotal = 0;

    if (combinedUnit < minSignPrice) {
        unitPrintTotal = minSignPrice * inputs.qty;
        R(`Sign Print (${inputs.thickness} ${inputs.color} Billed at ${billedW}"x${billedH}")`, unitPrintTotal, `${inputs.qty}x Signs @ $${minSignPrice.toFixed(2)} (Unit Minimum)`);
    } else {
        unitPrintTotal = rawUnitPrint * inputs.qty;
        R(`Base Print (${inputs.thickness} ${inputs.color} Billed at ${billedW}"x${billedH}")`, unitPrintTotal, `${inputs.qty}x Signs (${billedSqFt} SF) @ $${baseRate.toFixed(2)}/sf`);
        if (inputs.sides === 2) {
            R(`Double Sided Adder`, rawUnitDS * inputs.qty, `${totalBilledSqFt.toFixed(1)} Billed SF @ +50% Base Rate`);
            unitPrintTotal += (rawUnitDS * inputs.qty);
        }
    }

    let lamTotal = 0;
    if (inputs.laminate && inputs.laminate !== 'None') {
        const lamAdder = parseFloat(config.Retail_Price_Gloss || "8");
        lamTotal = (lamAdder * actualSqFt) * inputs.qty;
        R(`Laminate Finish`, lamTotal, `${inputs.qty}x Lam @ $${lamAdder}/sf`);
    }

    let routerFee = 0;
    if (inputs.shape !== 'Rectangle') {
        routerFee = inputs.shape === 'CNC Simple' ? parseFloat(config.Retail_Fee_Router_Easy || "30") : parseFloat(config.Retail_Fee_Router_Hard || "50");
        R(`CNC Router Fee`, routerFee, `Shape Routing Fee`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "50");
    let isMinApplied = false; let grandTotal = grandTotalRaw;

    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Minimum order difference`);
        grandTotal = minOrder; isMinApplied = true;
    }

    // --- 2. COST ENGINE ---
    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const sheetCost = inputs.thickness === '6mm' ? parseFloat(config.Cost_Stock_6mm_4x8 || "58.37") : parseFloat(config.Cost_Stock_3mm_4x8 || "45.10");
    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    const riskFactor = parseFloat(config.Factor_Risk || "1.05");
    const rateOp = parseFloat(config.Rate_Operator || "25");

    const rawBlanks = L(`ACM Substrate (${inputs.thickness})`, (totalActualSqFt / 32) * sheetCost, `(${totalActualSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);
    L(`Job Setup (File RIP)`, (parseFloat(config.Time_Setup_Job || "15") / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Flatbed Ink`, totalActualSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * multDS, `${totalActualSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(config.Machine_Speed_LF_Hr || "25")) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(config.Labor_Attendance_Ratio || "0.10"), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(config.Rate_Machine_Flatbed || "10"), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * riskFactor;
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: unitPrintTotal, routerFee }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 }) }
})