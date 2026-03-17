declare const Deno: any;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const requestData = await req.json();
    const inputs = requestData.inputs || {};
    const config = requestData.config || {};
    const panels = inputs.panels || [];

    const ret: any[] = [];
    const cst: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };

    let totalPrintRetail = 0;
    let totalInstallRetail = 0;
    let totalActualSqFt = 0;
    let totalCostMat = 0;

    // BILLED BRACKET LOGIC (12" Increments)
    const getBracket = (val: number) => {
        const brackets = [1-14];
        for (let b of brackets) { if (val <= b) return b; }
        return Math.ceil(val / 12) * 12;
    };

    panels.forEach((p: any) => {
        const actualArea = (p.w * p.h) / 144;
        totalActualSqFt += actualArea;

        const billedW = getBracket(p.w);
        const billedH = getBracket(p.h);
        const billedSqFt = (billedW * billedH) / 144;

        let rate = parseFloat(config.Retail_Rate_Wall || "10");
        if (p.material === 'textured') rate = parseFloat(config.Retail_Rate_Wall_Text || "15");
        else if (p.material === 'perf6040') rate = parseFloat(config.Retail_Rate_Perf || "12");

        let printCost = rate * billedSqFt;
        totalPrintRetail += printCost;
        R(`Wall Panel (${p.material} Billed at ${billedW}"x${billedH}")`, printCost, `${billedSqFt} SF @ $${rate}/sf`);

        if (inputs.install === 'Yes') {
            let installRate = parseFloat(config.Retail_Install_Wall_SqFt || "3");
            totalInstallRetail += (installRate * actualArea);
        }

        // Tally Material Costs Linearly
        let vCost = p.material === 'smooth' ? parseFloat(config.Cost_Vin_Wall || "0.59") : (p.material === 'textured' ? parseFloat(config.Cost_Vin_Wall_Text || "1.14") : parseFloat(config.Cost_Vinyl_Perf || "0.65"));
        let lCost = p.laminate !== 'No Lam' ? parseFloat(config.Cost_Lam_Wall || "0.36") : 0;
        totalCostMat += (vCost + lCost) * actualArea;
    });

    if (inputs.install === 'Yes') R(`Wall Installation`, totalInstallRetail, `Actual SF * Install Rate`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "150");
    let isMinApplied = false; let grandTotal = grandTotalRaw;

    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Difference`);
        grandTotal = minOrder; isMinApplied = true;
    }

    // --- COST ENGINE (PHYSICAL ACTUALS) ---
    L(`Wall Media & Lam`, totalCostMat * parseFloat(config.Waste_Factor || "1.25"), `Actual SF * Mat Cost * Waste`);
    L(`Latex Ink`, totalActualSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * 1.25, `Actual SF * Ink Cost * Waste`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.1");
    const payload = { retail: { unitPrice: grandTotal / (inputs.qty || 1), grandTotal, breakdown: ret, isMinApplied, printTotal: totalPrintRetail }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 }) }
})