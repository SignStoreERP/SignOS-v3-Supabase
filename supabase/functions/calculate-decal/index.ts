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

    let baseRate = 8;
    switch(inputs.material) {
        case 'Cast': baseRate = parseFloat(config.Retail_Price_Cast_SqFt || "14"); break;
        case 'Reflective': baseRate = parseFloat(config.Retail_Price_Reflective_SqFt || "15"); break;
        case 'Clear': baseRate = parseFloat(config.Retail_Price_Clear_SqFt || "10"); break;
        case 'Translucent': baseRate = parseFloat(config.Retail_Price_Trans_SqFt || "10"); break;
        default: baseRate = parseFloat(config.Retail_Price_Cal_SqFt || "8");
    }

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