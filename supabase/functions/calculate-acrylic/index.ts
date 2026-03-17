// Tells VS Code to stop looking for Deno configurations and accept it globally
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
    const thk = String(inputs.thickness || '0.25');

    // BILLED BRACKET LOGIC (12" Increments)
    const getBracket = (val: number) => {
        const brackets = [1-10];
        for (let b of brackets) { if (val <= b) return b; }
        return Math.ceil(val / 12) * 12;
    };
    const billedW = getBracket(inputs.w);
    const billedH = getBracket(inputs.h);
    const billedSqFt = (billedW * billedH) / 144;

    const ret: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRate = 0;
    if (thk === '0.25') {
        if (billedSqFt < 10) baseRate = parseFloat(config.ACR_14_T1_Rate || "40");
        else if (billedSqFt < 20) baseRate = parseFloat(config.ACR_14_T2_Rate || "35");
        else baseRate = parseFloat(config.ACR_14_T3_Rate || "30");
    } else if (thk === '0.5') {
        if (billedSqFt < 10) baseRate = parseFloat(config.ACR_12_T1_Rate || "45");
        else baseRate = parseFloat(config.ACR_12_T2_Rate || "40");
    } else if (thk === '0.75') {
        if (billedSqFt < 10) baseRate = parseFloat(config.ACR_34_T1_Rate || "55");
        else baseRate = parseFloat(config.ACR_34_T2_Rate || "50");
    } else {
        if (billedSqFt < 10) baseRate = parseFloat(config.ACR_1IN_T1_Rate || "60");
        else baseRate = parseFloat(config.ACR_1IN_T2_Rate || "55");
    }

    let unitPrintTotal = 0;
    let rawUnitPrint = baseRate * billedSqFt;
    const minSignPrice = parseFloat(config.Retail_Min_Acrylic || "75");

    if (rawUnitPrint < minSignPrice) {
        unitPrintTotal = minSignPrice * inputs.qty;
        R(`Acrylic (${thk}" Billed at ${billedW}"x${billedH}")`, unitPrintTotal, `${inputs.qty}x Signs @ $${minSignPrice.toFixed(2)} (Unit Minimum)`);
    } else {
        unitPrintTotal = rawUnitPrint * inputs.qty;
        R(`Acrylic (${thk}" Billed at ${billedW}"x${billedH}")`, unitPrintTotal, `${inputs.qty}x Signs (${billedSqFt} SF) @ $${baseRate}/sf`);
    }

    if (inputs.printMethod === 'Second Surface') R(`Second Surface / White Ink`, parseFloat(config.Retail_Adder_2ndSurf || "5") * billedSqFt * inputs.qty, `+$5/sf`);
    if (inputs.printMethod === 'Blockout') R(`Blockout / 3-Layer`, parseFloat(config.Retail_Adder_Blockout || "8") * billedSqFt * inputs.qty, `+$8/sf`);
    if (inputs.paintedBack === 'Yes') R(`Painted Background`, (parseFloat(config.Retail_Adder_Paint_SqFt || "20") * billedSqFt * inputs.qty) + parseFloat(config.Retail_Fee_Paint_Setup || "65"), `Paint Setup + $20/sf`);

    let routerFee = 0;
    if (inputs.shape !== 'Rectangle') {
        routerFee = inputs.shape === 'CNC Simple' ? parseFloat(config.Retail_Fee_Router_Easy || "30") : parseFloat(config.Retail_Fee_Router_Hard || "50");
        R(`CNC Router Fee`, routerFee, `Shape Routing Fee`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    let grandTotal = grandTotalRaw;
    let isMinApplied = false;

    // Apply Global Shop Minimum as final check
    const minOrder = parseFloat(config.Retail_Min_Order || "75");
    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Difference`);
        grandTotal = minOrder; isMinApplied = true;
    }

    // --- COST ENGINE (PHYSICAL ACTUALS) ---
    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };

    let thkKey = '14';
    if (thk === '0.5') thkKey = '12';
    if (thk === '0.75') thkKey = '34';
    if (thk === '1') thkKey = '1IN';
    const colorKey = inputs.color === 'Clear' ? 'C' : 'W';
    
    const sheetCost = parseFloat(config[`Cost_Stock_${thkKey}_4x8_${colorKey}`] || "120.55");
    const wastePct = parseFloat(config.Waste_Factor || "1.25");
    
    L(`Acrylic Yield (${thk}" ${inputs.color})`, (totalActualSqFt / 32) * sheetCost * wastePct, `(${totalActualSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht * 25% Waste`);
    L(`Latex Ink`, totalActualSqFt * parseFloat(config.Cost_Ink_Latex || "0.16"), `${totalActualSqFt.toFixed(1)} Actual SF * $0.16`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.1");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: unitPrintTotal, routerFee }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 }) }
})