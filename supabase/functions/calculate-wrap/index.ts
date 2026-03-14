const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { inputs, config } = await req.json()
    const ret: any[] = []; const cst: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };

    let totalSqFt = 0;
    let printTotalRaw = 0;
    let installTotalRaw = 0;

    inputs.panels.forEach((p: any) => {
        const area = (p.w * p.h) / 144 * inputs.qty;
        if(!p.included) {
            totalSqFt += area;
            const rate = p.material.startsWith('perf') ? parseFloat(config.Retail_Price_Perf_SqFt || "12") : parseFloat(config.Retail_Price_Vehicle_SqFt || "15");
            printTotalRaw += (area * rate);
        }
        if(inputs.install === 'Yes') {
            installTotalRaw += (area * parseFloat(config.Retail_Price_Install_Simple || "5"));
        }
    });

    R(`Printed Graphics`, printTotalRaw, `Total Wrap Area`);
    if (inputs.install === 'Yes') R(`Installation Labor`, installTotalRaw, `Install Labor`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "150");
    let isMinApplied = false; let grandTotal = grandTotalRaw;
    if (grandTotalRaw < minOrder) { R(`Shop Minimum`, minOrder - grandTotalRaw, `Difference`); grandTotal = minOrder; isMinApplied = true; }

    const wastePct = parseFloat(config.Waste_Factor || "1.25");
    L(`Wrap Media & Lam`, totalSqFt * parseFloat(config.Cost_Vin_Vehicle || "0.89") * wastePct, `Media + Lam Cost`);
    L(`Latex Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16"), `Ink Cost`);
    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.10");

    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: printTotalRaw, installTotal: installTotalRaw, displaySqFt: totalSqFt }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }) }
})