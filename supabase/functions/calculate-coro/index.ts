// Tells VS Code to stop looking for Deno configurations and accept it globally
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Renamed to 'requestData' to prevent the redeclaration error
    const requestData = await req.json();
    const inputs = requestData.inputs || {};
    const config = requestData.config || {};

    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;
    const thk = String(inputs.thickness || '4mm');

    // --- 1. RETAIL ENGINE (DUAL LEDGER) ---
    const ret: any[] = [];
    const R = (label: string, total: number, formula: string) => {
        if(total > 0) ret.push({label, total, formula});
        return total;
    };

    let baseRate = 0;
    if (thk === '4mm') {
        if (sqft <= 3.99) baseRate = parseFloat(config.COR4_T1_Rate || "8.33");
        else if (sqft <= 15.99) baseRate = parseFloat(config.COR4_T2_Rate || "7");
        else if (sqft <= 31.99) baseRate = parseFloat(config.COR4_T3_Rate || "6");
        else baseRate = parseFloat(config.COR4_T4_Rate || "5");
    } else {
        if (sqft <= 3.99) baseRate = parseFloat(config.COR10_T1_Rate || "25");
        else if (sqft <= 15.99) baseRate = parseFloat(config.COR10_T2_Rate || "21");
        else if (sqft <= 31.99) baseRate = parseFloat(config.COR10_T3_Rate || "18");
        else baseRate = parseFloat(config.COR10_T4_Rate || "15");
    }

    let unitPrint = baseRate * sqft;
    const minSignPrice = thk === '4mm' ? parseFloat(config.COR4_T1_Min || "25") : parseFloat(config.COR10_T1_Min || "75");

    if (unitPrint < minSignPrice) unitPrint = minSignPrice;
    R(`Base Print (${thk})`, unitPrint * inputs.qty, `${inputs.qty}x Signs @ $${baseRate}/sf`);

    let dsAdderTotal = 0;
    if (inputs.sides === 2) {
        const dsMult = parseFloat(config.Retail_Adder_DS_Mult || "0.5");
        dsAdderTotal = (baseRate * dsMult) * totalSqFt;
        R(`Double Sided Adder`, dsAdderTotal, `${totalSqFt.toFixed(1)} SF @ +${(dsMult * 100).toFixed(0)}% Base Rate`);
    }

    let lamTotal = 0;
    if (inputs.laminate && inputs.laminate !== 'None') {
        const lamAdder = parseFloat(config.Retail_Price_Gloss || "8");
        lamTotal = (lamAdder * sqft) * inputs.qty;
        R(`Laminate Finish`, lamTotal, `${inputs.qty}x Lam @ $${lamAdder}/sf`);
    }

    let routerFee = 0;
    if (inputs.shape !== 'Rectangle') {
        routerFee = inputs.shape === 'CNC Simple' ? parseFloat(config.Retail_Fee_Router_Easy || "30") : parseFloat(config.Retail_Fee_Router_Hard || "50");
        R(`CNC Router Fee`, routerFee, `Flat Shape Routing Fee`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "50");
    let isMinApplied = false;
    let grandTotal = grandTotalRaw;

    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Minimum order difference`);
        grandTotal = minOrder;
        isMinApplied = true;
    }

    const printTotal = (unitPrint * inputs.qty) + dsAdderTotal + lamTotal;

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => {
        if(total > 0) cst.push({label, total, formula});
        return total;
    };

    const sheetCost = thk === '10mm' ? parseFloat(config.Cost_Stock_10mm_4x8 || "33.49") : parseFloat(config.Cost_Stock_4mm_4x8 || "8.40");
    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    const riskFactor = parseFloat(config.Factor_Risk || "1.05");
    const rateOp = parseFloat(config.Rate_Operator || "25");
    const rateShop = parseFloat(config.Rate_Shop_Labor || "20");

    const yieldX = Math.floor(48 / inputs.w) * Math.floor(96 / inputs.h);
    const yieldY = Math.floor(48 / inputs.h) * Math.floor(96 / inputs.w);
    const bestYield = Math.max(yieldX, yieldY, 1);
    const rawBlanks = (inputs.qty / bestYield) * sheetCost;

    L(`Coroplast Blanks (${thk})`, rawBlanks, `${inputs.qty} Qty / ${bestYield} Yield * $${sheetCost.toFixed(2)}/Sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);

    L(`Flatbed Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(config.Machine_Speed_LF_Hr || "25")) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(config.Labor_Attendance_Ratio || "0.10"), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(config.Rate_Machine_Flatbed || "10"), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    L(`Job Setup (File RIP)`, (parseFloat(config.Time_Setup_Job || "15") / 60) * rateOp, `15 Mins * $${rateOp}/hr`);

    if (inputs.shape !== 'Rectangle') {
        const cncTime = inputs.shape === 'CNC Simple' ? parseFloat(config.Time_CNC_Easy_SqFt || "1") : parseFloat(config.Time_CNC_Complex_SqFt || "2");
        const cutHrs = (totalSqFt * cncTime) / 60;
        const cncSetup = parseFloat(config.Time_Setup_CNC || "10");
        L(`CNC Router Setup`, (cncSetup / 60) * parseFloat(config.Rate_CNC_Labor || "25"), `${cncSetup} Mins * $25/hr`);
        L(`CNC Router Run`, cutHrs * parseFloat(config.Rate_Machine_CNC || "10"), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(config.Rate_CNC_Labor || "25"), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
    } else {
        const shearSetup = parseFloat(config.Time_Shear_Setup || "5");
        L(`Shear Machine Setup`, (shearSetup / 60) * rateShop, `${shearSetup} Mins * $${rateShop}/hr`);
        const shearCuts = inputs.qty * 4;
        L(`Shear Per-Cut Run`, (shearCuts * parseFloat(config.Time_Shear_Cut || "1") / 60) * rateShop, `${shearCuts} Cuts * 1 Min * $${rateShop}/hr`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    // This is the true output payload for the response
    const payload = {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret, isMinApplied, printTotal, routerFee },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  }
})