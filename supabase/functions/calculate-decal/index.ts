declare const Deno: any;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const requestData = await req.json();
    const inputs = requestData.inputs || {};
    const config = requestData.config || {};

    const actualSqFt = (inputs.w * inputs.h) / 144;
    const totalActualSqFt = actualSqFt * inputs.qty;

    // BILLED BRACKET LOGIC (12" Increments)
    const getBracket = (val: number) => {
        const brackets = [1-10];
        for (let b of brackets) { if (val <= b) return b; }
        return Math.ceil(val / 12) * 12;
    };
    const billedW = getBracket(inputs.w);
    const billedH = getBracket(inputs.h);
    const billedSqFt = (billedW * billedH) / 144;
    const totalBilledSqFt = billedSqFt * inputs.qty;

    const ret: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRate = 8.00;
    if (inputs.material === 'Cast') baseRate = parseFloat(config.Retail_Price_Cast_SqFt || "14");
    else if (inputs.material === 'Clear' || inputs.material === 'Translucent') baseRate = parseFloat(config.Retail_Rate_Clear || "10");
    else if (inputs.material === 'Reflective') baseRate = parseFloat(config.Retail_Rate_Refl || "15");
    else baseRate = parseFloat(config.Retail_Price_Cal_SqFt || "8");

    let unitPrint = baseRate * billedSqFt;
    R(`Base Print (${inputs.material} Billed at ${billedW}"x${billedH}")`, unitPrint * inputs.qty, `${inputs.qty}x (${billedSqFt} SF) @ $${baseRate}/sf`);

    if (inputs.shape !== 'Rectangle') R(`Contour Cut`, unitPrint * inputs.qty * parseFloat(config.Retail_Cut_Contour_Add || "0.25"), `+25% Base Rate`);
    if (inputs.weeding === 'Complex') R(`Complex Weeding`, parseFloat(config.Retail_Weed_Complex || "2.5") * totalBilledSqFt, `+$2.50/sf`);
    if (inputs.masking === 'Yes') R(`Transfer Tape (Masking)`, parseFloat(config.Retail_Adder_Mask_SqFt || "1") * totalBilledSqFt, `+$1.00/sf`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "35");
    let isMinApplied = false; let grandTotal = grandTotalRaw;

    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Difference`);
        grandTotal = minOrder; isMinApplied = true;
    }

    // --- COST ENGINE (PHYSICAL ACTUALS) ---
    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };
    
    let vCost = inputs.material === 'Cast' ? parseFloat(config.Cost_Vin_Cast || "1.30") : parseFloat(config.Cost_Vin_Cal || "0.21");
    let lCost = inputs.material === 'Cast' ? parseFloat(config.Cost_Lam_Cast || "0.96") : parseFloat(config.Cost_Lam_Cal || "0.36");
    
    L(`Vinyl Media & Lam`, totalActualSqFt * (vCost + lCost) * parseFloat(config.Waste_Factor || "1.15"), `Actual SF * Mat Cost * Waste`);
    L(`Latex Ink`, totalActualSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * 1.15, `Actual SF * Ink Cost * Waste`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.05");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: unitPrint * inputs.qty }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 }) }
})