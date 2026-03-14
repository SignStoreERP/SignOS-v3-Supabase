const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { inputs, config } = await req.json()

    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;

    // --- 1. RETAIL ENGINE ---
    const ret: any[] = [];
    const R = (label: string, total: number, formula: string) => { 
        if(total > 0) ret.push({label, total, formula}); 
        return total; 
    };

    let baseRate = inputs.thickness === '6mm' ? parseFloat(config.ACM6_T1_Rate || "16.50") : parseFloat(config.ACM3_T1_Rate || "14.00");

    R(`Base Print (${inputs.thickness})`, baseRate * totalSqFt, `${totalSqFt.toFixed(1)} SF @ $${baseRate}`);

    if (inputs.sides === 2) R(`Double Sided Adder`, (totalSqFt * parseFloat(config.Retail_Adder_DS_Mult || "0.5") * baseRate), `+50% Side 2 Markup`);

    if (inputs.laminate && inputs.laminate !== 'None') {
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
    let isMinApplied = false;
    let grandTotal = grandTotalRaw;
    
    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Minimum order difference`);
        grandTotal = minOrder;
        isMinApplied = true;
    }

    const printTotal = (baseRate * totalSqFt) + (inputs.sides === 2 ? (totalSqFt * parseFloat(config.Retail_Adder_DS_Mult || "0.5") * baseRate) : 0);

    // --- 2. COST ENGINE ---
    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { 
        if(total > 0) cst.push({label, total, formula}); 
        return total; 
    };

    const sheetCost = inputs.thickness === '6mm' ? parseFloat(config.Cost_Stock_6mm_4x8 || "58.37") : parseFloat(config.Cost_Stock_3mm_4x8 || "45.10");
    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    const riskFactor = parseFloat(config.Factor_Risk || "1.05");
    const rateOp = parseFloat(config.Rate_Operator || "25");
    const rateShop = parseFloat(config.Rate_Shop_Labor || "20");

    const rawBlanks = L(`ACM Substrate (${inputs.thickness})`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);

    L(`Job Setup (File RIP)`, (parseFloat(config.Time_Setup_Job || "15") / 60) * rateOp, `15 Mins * $${rateOp}/hr`);

    L(`Flatbed Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(config.Machine_Speed_LF_Hr || "25")) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(config.Labor_Attendance_Ratio || "0.10"), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(config.Rate_Machine_Flatbed || "10"), `${printHrs.toFixed(2)} Hrs * $10/hr`);
    L(`Load/Unload Printer`, (parseFloat(config.Time_Handling || "5") * multDS / 60) * rateOp, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    if (inputs.laminate && inputs.laminate !== 'None') {
        const lamCost = totalSqFt * parseFloat(config.Cost_Lam_SqFt || "0.36") * multDS;
        L(`Laminate Media`, lamCost * wastePct, `${totalSqFt.toFixed(1)} SF * $0.36/SF * Waste`);

        const lamHrs = totalSqFt / parseFloat(config.Speed_Lam_Roll || "300") * multDS;
        L(`Laminator Op (100% Attn)`, lamHrs * rateShop, `${lamHrs.toFixed(2)} Hrs * $${rateShop}/hr * 100%`);
        L(`Laminator Machine Run`, lamHrs * parseFloat(config.Rate_Machine_Lam || "5"), `${lamHrs.toFixed(2)} Hrs * $5/hr`);
        L(`Load/Unload Laminator`, (parseFloat(config.Time_Handling || "5") * multDS / 60) * rateShop, `Handling Mins * ${multDS} Sides`);
    }

    if (inputs.shape !== 'Rectangle') {
        const cutHrs = (totalSqFt * (inputs.shape === 'CNC Simple' ? 1 : 2)) / 60;
        L(`CNC Router Run`, cutHrs * parseFloat(config.Rate_Machine_CNC || "10"), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(config.Rate_CNC_Labor || "25"), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
        L(`Load/Unload Router`, (parseFloat(config.Time_Handling || "5") / 60) * rateOp, `5 Mins * $${rateOp}/hr`);
    } else {
        const shearSetup = parseFloat(config.Time_Shear_Setup || "5");
        L(`Shear Machine Setup`, (shearSetup / 60) * rateShop, `${shearSetup} Mins * $${rateShop}/hr`);
        const shearCuts = inputs.qty * 4;
        L(`Shear Per-Cut Run`, (shearCuts * parseFloat(config.Time_Shear_Cut || "1") / 60) * rateShop, `${shearCuts} Cuts * 1 Min * $${rateShop}/hr`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    const payload = {
      retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret, isMinApplied, printTotal, routerFee },
      cost: { total: totalCost, breakdown: cst },
      metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})