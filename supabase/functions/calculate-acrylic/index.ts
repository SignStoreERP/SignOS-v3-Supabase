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
    let thk = String(inputs.thickness);
    if (thk === '1/4') thk = '0.25';
    if (thk === '1/2') thk = '0.5';
    if (thk === '3/4') thk = '0.75';
    if (thk === '1') thk = '1';

    const ret: any[] = [];
    const R = (label: string, total: number, formula: string) => {
        if(total > 0) ret.push({label, total, formula});
        return total;
    };

    const thkNum = parseFloat(thk) || 0.25;
    const baseSqFtRate = parseFloat(config.ACR_14_T1_Rate || "30") * (thkNum / 0.25);
    const unitPrint = baseSqFtRate * totalSqFt;

    R(`Base Print (${thk}" ${inputs.color})`, unitPrint, `${totalSqFt.toFixed(1)} SF @ $${baseSqFtRate}`);

    let routerFee = 0;
    if (inputs.shape !== 'Rectangle') {
        // FIXED: Dynamically references SQL config based on complexity
        routerFee = inputs.shape === 'CNC Simple' ? parseFloat(config.Retail_Fee_Router_Easy || "30") : parseFloat(config.Retail_Fee_Router_Hard || "50");
        R(`CNC Router Fee`, routerFee, `Shape Routing Fee`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "75");
    let isMinApplied = false;
    let grandTotal = grandTotalRaw;

    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Minimum order difference`);
        grandTotal = minOrder;
        isMinApplied = true;
    }

    // --- COST ENGINE ---
    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => {
        if(total > 0) cst.push({label, total, formula});
        return total;
    };

    let thkKey = '14';
    if (thk === '0.5') thkKey = '12';
    if (thk === '0.75') thkKey = '34';
    if (thk === '1') thkKey = '1IN';

    const colorKey = inputs.color === 'Clear' ? 'C' : 'W';
    const sheetCost = parseFloat(config[`Cost_Stock_${thkKey}_4x8_${colorKey}`] || "120.55");
    const rawBlanks = L(`Acrylic Yield (${thk}" ${inputs.color})`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);

    const wastePct = parseFloat(config.Waste_Factor || "1.25");
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);
    L(`Flatbed Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16"), `${totalSqFt.toFixed(1)} SF * $0.16/SF`);

    const rateOp = parseFloat(config.Rate_Operator || "25");
    L(`Job Setup (File RIP)`, (parseFloat(config.Time_Setup_Job || "15") / 60) * rateOp, `15 Mins * $${rateOp}/hr`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(config.Speed_Print_1st || "18"));
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(config.Labor_Attendance_Ratio || "0.10"), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(config.Rate_Machine_Flatbed || "10"), `${printHrs.toFixed(2)} Hrs * $10/hr`);
    L(`Load/Unload Printer`, (parseFloat(config.Time_Handling || "5") / 60) * rateOp, `5 Mins * $${rateOp}/hr`);

    if (inputs.shape !== 'Rectangle') {
        // FIXED: Pulls exact routing times from SQL instead of hardcoding 1 minute
        const cncTime = inputs.shape === 'CNC Simple' ? parseFloat(config.Time_CNC_Easy_SqFt || "1") : parseFloat(config.Time_CNC_Complex_SqFt || "2");
        const cutHrs = (totalSqFt * cncTime) / 60;
        
        L(`CNC Router Run`, cutHrs * parseFloat(config.Rate_Machine_CNC || "10"), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(config.Rate_CNC_Labor || "25"), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
    }

    const hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(config.Factor_Risk || "1.10");

    const payload = {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret, isMinApplied, printTotal: unitPrint, routerFee },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})