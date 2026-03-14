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
    if (inputs.thickness === '3mm') {
        if (sqft <= 2.99) baseSqFtRate = parseFloat(config.PVC3_T1_Rate || "44");
        else if (sqft <= 5.99) baseSqFtRate = parseFloat(config.PVC3_T2_Rate || "13.20");
        else if (sqft <= 11.99) baseSqFtRate = parseFloat(config.PVC3_T3_Rate || "8.40");
        else baseSqFtRate = parseFloat(config.PVC3_T4_Rate || "7.80");
    } else {
        if (sqft <= 2.99) baseSqFtRate = parseFloat(config.PVC6_T1_Rate || "44");
        else if (sqft <= 5.99) baseSqFtRate = parseFloat(config.PVC6_T2_Rate || "22");
        else if (sqft <= 11.99) baseSqFtRate = parseFloat(config.PVC6_T3_Rate || "14");
        else baseSqFtRate = parseFloat(config.PVC6_T4_Rate || "13");
    }

    let unitPrint = baseSqFtRate * totalSqFt;
    R(`Base Print (${inputs.thickness})`, unitPrint, `${totalSqFt.toFixed(1)} SF @ $${baseSqFtRate}`);

    if (inputs.sides === 2) R(`Double Sided Adder`, (totalSqFt * parseFloat(config.Retail_Adder_DS_Mult || "0.5") * baseSqFtRate), `+50% Side 2 Markup`);
    
    if (inputs.laminate === 'None') R(`No Laminate Deduction`, -(unitPrint * parseFloat(config.Retail_Lam_Deduct || "0.10")), `-10% Base Deduction`);
    else if (inputs.laminate && inputs.laminate !== 'None') {
        const lamAdder = parseFloat(config.Retail_Price_Gloss || "8");
        R(`Laminate Finish`, (lamAdder * sqft) * inputs.qty, `${inputs.qty}x Lam @ $${lamAdder}/sf`);
    }

    let routerFee = 0;
    if (inputs.shape !== 'Rectangle') {
        routerFee = inputs.shape === 'CNC Simple' ? parseFloat(config.Retail_Fee_Router_Easy || "30") : parseFloat(config.Retail_Fee_Router_Hard || "50");
        R(`CNC Router Fee`, routerFee, `Shape Routing Fee`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "50");
    let isMinApplied = false; let grandTotal = grandTotalRaw;
    if (grandTotalRaw < minOrder) { R(`Shop Minimum`, minOrder - grandTotalRaw, `Difference`); grandTotal = minOrder; isMinApplied = true; }

    const printTotal = unitPrint + (inputs.sides === 2 ? (totalSqFt * parseFloat(config.Retail_Adder_DS_Mult || "0.5") * baseSqFtRate) : 0) + (inputs.laminate === 'None' ? -(unitPrint * parseFloat(config.Retail_Lam_Deduct || "0.10")) : (inputs.laminate && inputs.laminate !== 'None' ? (parseFloat(config.Retail_Price_Gloss || "8") * sqft) * inputs.qty : 0));

    const sheetCost = inputs.thickness === '6mm' ? parseFloat(config.Cost_Stock_6mm_4x8 || "58.37") : parseFloat(config.Cost_Stock_3mm_4x8 || "29.09");
    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    const riskFactor = parseFloat(config.Factor_Risk || "1.05");
    const rateOp = parseFloat(config.Rate_Operator || "25");
    const rateShop = parseFloat(config.Rate_Shop_Labor || "20");

    const rawBlanks = L(`PVC Substrate (${inputs.thickness})`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);

    L(`Flatbed Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);
    L(`Job Setup (File RIP)`, (parseFloat(config.Time_Setup_Job || "15") / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Material Handling`, (parseFloat(config.Time_Handling || "5") * multDS / 60) * rateOp, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(config.Machine_Speed_LF_Hr || "25")) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(config.Labor_Attendance_Ratio || "0.10"), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(config.Rate_Machine_Flatbed || "10"), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    if (inputs.laminate && inputs.laminate !== 'None') {
        const lamCost = totalSqFt * parseFloat(config.Cost_Lam_SqFt || "0.36") * multDS;
        L(`Laminate Media`, lamCost * wastePct, `${totalSqFt.toFixed(1)} SF * $0.36/SF * Waste`);
        const lamHrs = totalSqFt / parseFloat(config.Speed_Lam_Roll || "300") * multDS;
        L(`Laminator Op (100% Attn)`, lamHrs * rateShop, `${lamHrs.toFixed(2)} Hrs * $${rateShop}/hr * 100%`);
        L(`Laminator Machine Run`, lamHrs * parseFloat(config.Rate_Machine_Lam || "5"), `${lamHrs.toFixed(2)} Hrs * $5/hr`);
    }

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