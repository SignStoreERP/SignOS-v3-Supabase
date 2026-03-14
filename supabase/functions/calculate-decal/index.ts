const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { inputs, config } = await req.json()
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const ret: any[] = []; const cst: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };

    let baseRate = inputs.material === 'Cast' ? parseFloat(config.Retail_Price_Cast_SqFt || "14") : parseFloat(config.Retail_Price_Cal_SqFt || "8");
    R(`Printed Vinyl (${inputs.material})`, baseRate * totalSqFt, `${totalSqFt.toFixed(1)} SF @ $${baseRate}`);
    if (inputs.shape === 'Contour') R(`Contour Cut Markup`, (baseRate * totalSqFt) * parseFloat(config.Retail_Cut_Contour_Add || "0.25"), `Shape Surcharge`);
    if (inputs.weeding === 'Complex') R(`Complex Weeding`, totalSqFt * parseFloat(config.Retail_Weed_Complex || "2.5"), `Weeding Surcharge`);
    if (inputs.masking === 'Yes') R(`Transfer Tape`, totalSqFt * parseFloat(config.Retail_Tape_SqFt || "1.5"), `Masking Surcharge`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "35");
    let isMinApplied = false; let grandTotal = grandTotalRaw;
    if (grandTotalRaw < minOrder) { R(`Shop Minimum`, minOrder - grandTotalRaw, `Difference`); grandTotal = minOrder; isMinApplied = true; }

    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    L(`Vinyl Media`, totalSqFt * parseFloat(config.Cost_Vin_Cal || "0.36") * wastePct, `Media Cost`);
    L(`Latex Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16"), `Ink Cost`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.05");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: baseRate * totalSqFt }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }) }
})