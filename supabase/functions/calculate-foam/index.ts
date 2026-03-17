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

    let baseSqFtRate = 0;
    if (billedSqFt < 4) baseSqFtRate = parseFloat(config.FOM3_T1_Rate || "8.33");
    else if (billedSqFt < 16) baseSqFtRate = parseFloat(config.FOM3_T2_Rate || "8");
    else if (billedSqFt < 32) baseSqFtRate = parseFloat(config.FOM3_T3_Rate || "7");
    else baseSqFtRate = parseFloat(config.FOM3_T4_Rate || "6");

    let rawUnitPrint = baseSqFtRate * billedSqFt;
    let rawUnitDS = inputs.sides === 2 ? rawUnitPrint * parseFloat(config.Retail_Adder_DS_Mult || "0.5") : 0;
    let combinedUnit = rawUnitPrint + rawUnitDS;
    
    const minSignPrice = parseFloat(config.FOM3_T1_Min || "25");
    let unitPrintTotal = 0;

    if (combinedUnit < minSignPrice) {
        unitPrintTotal = minSignPrice * inputs.qty;
        R(`Sign Print (Billed at ${billedW}"x${billedH}")`, unitPrintTotal, `${inputs.qty}x Signs @ $${minSignPrice.toFixed(2)} (Unit Minimum)`);
    } else {
        unitPrintTotal = rawUnitPrint * inputs.qty;
        R(`Base Print (Billed at ${billedW}"x${billedH}")`, unitPrintTotal, `${inputs.qty}x Signs (${billedSqFt} SF) @ $${baseSqFtRate.toFixed(2)}/sf`);
        if (inputs.sides === 2) {
            R(`Double Sided Adder`, rawUnitDS * inputs.qty, `${totalBilledSqFt.toFixed(1)} Billed SF @ +50% Base Rate`);
            unitPrintTotal += (rawUnitDS * inputs.qty);
        }
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
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Difference`);
        grandTotal = minOrder; isMinApplied = true;
    }

    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };
    const sheetCost = parseFloat(config.Cost_Stock_316_4x8 || "13.86");
    
    L(`Foam Core (3/16")`, (totalActualSqFt / 32) * sheetCost * 1.15, `(${totalActualSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht * Waste`);
    L(`Flatbed Ink`, totalActualSqFt * 0.16 * multDS, `${totalActualSqFt.toFixed(1)} SF * $0.16/SF`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.05");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: unitPrintTotal, routerFee }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 }) }
})
