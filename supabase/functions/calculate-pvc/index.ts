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
    const R = (label: string, total: number, formula: string) => { if(total > 0 || total < 0) ret.push({label, total, formula}); return total; };

    let rawUnitPrint = 0;
    let baseRateLog = 0;

    // NOTE: PVC Tier 1 is a FLAT RATE MINIMUM ($33), not a per/sf multiplier
    if (inputs.thickness === '6mm') {
        if (billedSqFt < 3) rawUnitPrint = parseFloat(config.PVC6_T1_Min || "33");
        else if (billedSqFt < 6) { baseRateLog = parseFloat(config.PVC6_T2_Rate || "22"); rawUnitPrint = billedSqFt * baseRateLog; }
        else if (billedSqFt < 12) { baseRateLog = parseFloat(config.PVC6_T3_Rate || "14"); rawUnitPrint = billedSqFt * baseRateLog; }
        else { baseRateLog = parseFloat(config.PVC6_T4_Rate || "13"); rawUnitPrint = billedSqFt * baseRateLog; }
    } else {
        if (billedSqFt < 3) rawUnitPrint = parseFloat(config.PVC3_T1_Min || "33");
        else if (billedSqFt < 6) { baseRateLog = parseFloat(config.PVC3_T2_Rate || "13.20"); rawUnitPrint = billedSqFt * baseRateLog; }
        else if (billedSqFt < 12) { baseRateLog = parseFloat(config.PVC3_T3_Rate || "8.40"); rawUnitPrint = billedSqFt * baseRateLog; }
        else { baseRateLog = parseFloat(config.PVC3_T4_Rate || "7.80"); rawUnitPrint = billedSqFt * baseRateLog; }
    }

    R(`Base Print (${inputs.thickness} Billed at ${billedW}"x${billedH}")`, rawUnitPrint * inputs.qty, billedSqFt < 3 ? `${inputs.qty}x Signs @ Flat Rate` : `${inputs.qty}x Signs (${billedSqFt} SF) @ $${baseRateLog.toFixed(2)}/sf`);

    let rawUnitDS = inputs.sides === 2 ? rawUnitPrint * parseFloat(config.Retail_Adder_DS_Mult || "0.5") : 0;
    if (inputs.sides === 2) {
        R(`Double Sided Adder`, rawUnitDS * inputs.qty, `+50% Side 2 Markup`);
    }

    let unitPrintTotal = (rawUnitPrint + rawUnitDS) * inputs.qty;

    if (inputs.laminate === 'None') R(`No Laminate Deduction`, -(unitPrintTotal * parseFloat(config.Retail_Lam_Deduct || "0.10")), `-10% Base Deduction`);
    else if (inputs.laminate && inputs.laminate !== 'None') {
        R(`Laminate Finish`, (parseFloat(config.Retail_Price_Gloss || "8") * actualSqFt) * inputs.qty, `${inputs.qty}x Lam @ $8/sf`);
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
        R(`Shop Minimum`, minOrder - grandTotalRaw, `Difference`);
        grandTotal = minOrder; isMinApplied = true;
    }

    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };
    const sheetCost = inputs.thickness === '6mm' ? parseFloat(config.Cost_Stock_6mm_4x8 || "58.37") : parseFloat(config.Cost_Stock_3mm_4x8 || "29.09");
    
    L(`PVC Substrate (${inputs.thickness})`, (totalActualSqFt / 32) * sheetCost, `(${totalActualSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    L(`Flatbed Ink`, totalActualSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * multDS, `${totalActualSqFt.toFixed(1)} SF * $0.16/SF`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.05");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: unitPrintTotal, routerFee }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 }) }
})
