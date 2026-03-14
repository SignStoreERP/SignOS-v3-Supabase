const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { inputs, config } = await req.json()
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;
    const ret: any[] = []; const cst: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };

    let baseSqFtRate = 0;
    if (sqft <= 3.99) baseSqFtRate = parseFloat(config.FOM3_T1_Rate || "8.33");
    else if (sqft <= 15.99) baseSqFtRate = parseFloat(config.FOM3_T2_Rate || "8");
    else if (sqft <= 31.99) baseSqFtRate = parseFloat(config.FOM3_T3_Rate || "7");
    else baseSqFtRate = parseFloat(config.FOM3_T4_Rate || "6");

    let retailPrint = baseSqFtRate * totalSqFt;
    R(`Base Print (3/16")`, retailPrint, `${totalSqFt.toFixed(1)} SF @ $${baseSqFtRate}`);

    if (inputs.sides === 2) R(`Double Sided Adder`, (totalSqFt * parseFloat(config.Retail_Adder_DS_Mult || "0.5") * baseSqFtRate), `+50% Side 2 Markup`);

    let routerFee = 0;
    if (inputs.shape !== 'Rectangle') {
        routerFee = inputs.shape === 'CNC Simple' ? parseFloat(config.Retail_Fee_Router_Easy || "30") : parseFloat(config.Retail_Fee_Router_Hard || "50");
        R(`CNC Router Fee`, routerFee, `Shape Routing Fee`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "50");
    let isMinApplied = false; let grandTotal = grandTotalRaw;
    if (grandTotalRaw < minOrder) { R(`Shop Minimum`, minOrder - grandTotalRaw, `Difference`); grandTotal = minOrder; isMinApplied = true; }

    const printTotal = retailPrint + (inputs.sides === 2 ? (totalSqFt * parseFloat(config.Retail_Adder_DS_Mult || "0.5") * baseSqFtRate) : 0);

    const sheetCost = parseFloat(config.Cost_Stock_316_4x8 || "18.50");
    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    const riskFactor = parseFloat(config.Factor_Risk || "1.05");
    const rateOp = parseFloat(config.Rate_Operator || "25");

    const rawBlanks = L(`Foam Core (3/16")`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);

    L(`Flatbed Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);
    L(`Job Setup (File RIP)`, (parseFloat(config.Time_Setup_Job || "15") / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Material Handling`, (parseFloat(config.Time_Handling || "5") * multDS / 60) * rateOp, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(config.Machine_Speed_LF_Hr || "18")) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(config.Labor_Attendance_Ratio || "0.10"), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(config.Rate_Machine_Flatbed || "10"), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    if (inputs.shape !== 'Rectangle') {
        const cncTime = inputs.shape === 'CNC Simple' ? parseFloat(config.Time_CNC_Easy_SqFt || "1") : parseFloat(config.Time_CNC_Complex_SqFt || "2");
        const cutHrs = (totalSqFt * cncTime) / 60;
        L(`CNC Router Run`, cutHrs * parseFloat(config.Rate_Machine_CNC || "10"), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(config.Rate_CNC_Labor || "25"), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
    }

    const hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal, routerFee }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }) }
})