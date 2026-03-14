const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { inputs, config } = await req.json()
    const sqft = Math.ceil((inputs.w * inputs.h) / 144);
    const totalSqFt = sqft * inputs.qty;
    const ret: any[] = []; const cst: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };

    let baseRate = parseFloat(config.BAN13_T3_Rate || "5.00");
    R(`Printed Banner (${inputs.material || '13oz'})`, baseRate * totalSqFt, `${totalSqFt} SF @ $${baseRate}`);
    if (inputs.sides === 2) R(`Double Sided Adder`, (parseFloat(config.Retail_Adder_DS_SqFt || "3.00") * totalSqFt), `Side 2 Markup`);
    if (inputs.pockets === 'Top') R(`Pole Pockets (Top)`, (inputs.w / 12) * parseFloat(config.Retail_Fin_PolePkt_LF || "3") * inputs.qty, `Top Pocket`);
    else if (inputs.pockets === 'TopBottom') R(`Pole Pockets (T/B)`, ((inputs.w * 2) / 12) * parseFloat(config.Retail_Fin_PolePkt_LF || "3") * inputs.qty, `T/B Pockets`);
    if (inputs.windSlits === 'Yes') R(`Wind Slits`, parseFloat(config.Retail_Fee_WindSlit || "10") * inputs.qty, `Slit Markup`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "50");
    let isMinApplied = false; let grandTotal = grandTotalRaw;
    if (grandTotalRaw < minOrder) { R(`Shop Minimum`, minOrder - grandTotalRaw, `Difference`); grandTotal = minOrder; isMinApplied = true; }

    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    L(`Banner Media`, totalSqFt * parseFloat(config.Cost_Media_13oz || "0.25") * wastePct, `Media Cost`);
    L(`Latex Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16"), `Ink Cost`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.05");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: baseRate * totalSqFt }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }) }
})