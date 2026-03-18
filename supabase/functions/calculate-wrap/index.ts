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

    // BILLED BRACKET LOGIC (12" Increments for large panels)
    const getBracket = (val: number) => Math.ceil(val / 12) * 12;

    panels.forEach((p: any) => {
        const actualArea = (p.w * p.h) / 144;
        totalActualSqFt += actualArea;

        const billedW = getBracket(p.w);
        const billedH = getBracket(p.h);
        const billedSqFt = (billedW * billedH) / 144;

        let rate = p.material === 'perf6040' ? parseFloat(config.Retail_Rate_Perf || "12") : parseFloat(config.Retail_Price_Vehicle_SqFt || "15");
        
        // Window perf cost is often included in a full wrap package
        if (p.material.startsWith('perf') && p.included) rate = 0;
        
        let printCost = rate * billedSqFt;
        totalPrintRetail += printCost;
        
        R(`Panel (${p.material} Billed at ${billedW}"x${billedH}")`, printCost, `${billedSqFt} SF @ $${rate}/sf`);
        
        if (inputs.install === 'Yes') {
            let installRate = parseFloat(config.Retail_Install_Vehicle_SqFt || "5");
            totalInstallRetail += (installRate * actualArea); // Install logic uses Actual SF
        }
    });

    if (inputs.install === 'Yes') R(`Vehicle Installation`, totalInstallRetail, `Actual SF * Install Rate`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "150");
    let isMinApplied = false; 
    let grandTotal = grandTotalRaw;
    
    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Difference`);
        grandTotal = minOrder; 
        isMinApplied = true;
    }

    // --- COST ENGINE (PHYSICAL ACTUALS) ---
    L(`Vehicle Media & Lam`, totalActualSqFt * (1.30 + 0.96) * parseFloat(config.Waste_Factor || "1.25"), `Actual SF * Mat Cost * Waste`);
    L(`Latex Ink`, totalActualSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * parseFloat(config.Waste_Factor || "1.25"), `Actual SF * Ink Cost * Waste`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.1");

    // ADDED displaySqFt TO THE RETURN PAYLOAD
    const payload = { 
        retail: { 
            unitPrice: grandTotal / (inputs.qty || 1), 
            grandTotal, 
            breakdown: ret, 
            isMinApplied, 
            printTotal: totalPrintRetail, 
            displaySqFt: totalActualSqFt 
        }, 
        cost: { total: totalCost, breakdown: cst }, 
        metrics: { margin: (grandTotal - totalCost) / grandTotal } 
    };

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) { 
      return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 }) 
  }
});