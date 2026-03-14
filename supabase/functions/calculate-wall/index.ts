const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { inputs, config } = await req.json()
    let totalSqFt = 0, totalInstallSqFt = 0;
    const ret: any[] = []; const cst: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };

    inputs.panels.forEach((p: any) => {
        const area = (p.w * p.h) / 144 * inputs.qty;
        totalSqFt += area;
        let retailUnit = p.material === 'smooth' ? parseFloat(config.Retail_Price_Wall_Smooth_SqFt || "10") : (p.material === 'textured' ? parseFloat(config.Retail_Price_Wall_Text_SqFt || "15") : parseFloat(config.Retail_Price_Perf_SqFt || "12"));
        R(`Panel: ${p.label} [${p.material === 'smooth' ? 'Smooth' : (p.material === 'textured' ? 'Textured' : 'Window Perf')}]`, retailUnit * area, `${area.toFixed(1)} SF @ $${retailUnit}`);
        totalInstallSqFt += area;
    });

    let installTotalRaw = 0;
    if (inputs.install === 'Yes') {
        const installRate = parseFloat(config.Retail_Install_Wall_SqFt || "3");
        installTotalRaw = R(`Installation Labor`, totalInstallSqFt * installRate, `${totalInstallSqFt.toFixed(1)} SF @ $${installRate.toFixed(2)}`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "150");
    let isMinApplied = false; let grandTotal = grandTotalRaw;
    if (grandTotalRaw < minOrder) { R(`Shop Minimum`, minOrder - grandTotalRaw, `Difference`); grandTotal = minOrder; isMinApplied = true; }

    const wastePct = parseFloat(config.Waste_Factor || "1.25");
    let totalCostMat = 0;
    inputs.panels.forEach((p: any) => {
        const area = ((p.w * p.h) / 144) * inputs.qty * wastePct;
        let vCost = p.material === 'smooth' ? parseFloat(config.Cost_Vin_Wall || "0.59") : (p.material === 'textured' ? parseFloat(config.Cost_Vin_Wall_Text || "1.14") : parseFloat(config.Cost_Vinyl_Perf || "0.65"));
        let lCost = p.laminate !== 'No Lam' ? parseFloat(config.Cost_Lam_Wall || "0.36") : 0;
        totalCostMat += (vCost + lCost) * area;
    });

    L(`Wall Media & Lam`, totalCostMat, `Total SF * Mat Cost * ${wastePct} Waste`);
    L(`Latex Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * wastePct, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste`);

    const rateOp = parseFloat(config.Rate_Operator || "25");
    const rateShop = parseFloat(config.Rate_Shop_Labor || "20");
    const instRate = parseFloat(config.Rate_Install || "32");

    L(`File Prep & Rip`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    const printHrs = totalSqFt / parseFloat(config.Speed_Print_Roll || "150");
    L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(config.Labor_Attendance_Ratio || "0.10"), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Printer Run`, printHrs * parseFloat(config.Rate_Machine_Print || "5"), `${printHrs.toFixed(2)} Hrs * $5/hr`);

    let handCutMins = 0;
    inputs.panels.forEach((p: any) => {
        const perimeterLF = ((p.w * 2) + (p.h * 2)) / 12;
        handCutMins += perimeterLF * inputs.qty * parseFloat(config.Time_Cut_Hand || "0.25");
    });
    L(`Hand Trimming (Panels)`, (handCutMins / 60) * rateShop, `Total Perimeters * 0.25 Mins/LF * $${rateShop}/hr`);

    if (inputs.install === 'Yes') {
        const instHrs = totalInstallSqFt / parseFloat(config.Speed_Install_Wall || "25");
        L(`Installation Labor`, instHrs * instRate, `${totalInstallSqFt.toFixed(1)} SF / 25 SF/hr * $${instRate}/hr`);
    }

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.10");
    const printTotalRaw = ret.filter(r => r.label.includes('Panel')).reduce((sum, i) => sum + i.total, 0);

    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: printTotalRaw, installTotal: installTotalRaw, displaySqFt: totalSqFt }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }) }
})