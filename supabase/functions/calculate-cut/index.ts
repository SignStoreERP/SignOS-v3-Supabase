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

    let baseRate = 12.00;
    if (inputs.material === '751') baseRate = parseFloat(config.Retail_Price_751 || "18");
    else if (inputs.material === '951') baseRate = parseFloat(config.Retail_Price_951 || "22");
    else if (inputs.material === '8500') baseRate = parseFloat(config.Retail_Price_8500 || "20");
    else if (inputs.material === '8800') baseRate = parseFloat(config.Retail_Price_8800 || "25");
    else if (inputs.material === '8510' || inputs.material === '8810') baseRate = parseFloat(config.Retail_Price_Glass || "25");
    else if (inputs.material === 'Specialty') baseRate = parseFloat(config.Retail_Price_Specialty || "16");

    let unitPrint = baseRate * billedSqFt;
    R(`Cut Vinyl (${inputs.material} Billed at ${billedW}"x${billedH}")`, unitPrint * inputs.qty, `${inputs.qty}x (${billedSqFt} SF) @ $${baseRate}/sf`);

    if (inputs.weeding === 'Complex') R(`Complex Weeding`, parseFloat(config.Retail_Weed_Complex_Add || "5") * totalBilledSqFt, `+$5.00/sf`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "45");
    let isMinApplied = false; let grandTotal = grandTotalRaw;

    if (grandTotalRaw < minOrder) {
        R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Difference`);
        grandTotal = minOrder; isMinApplied = true;
    }

    // --- COST ENGINE (PHYSICAL ACTUALS) ---
    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };
    
    let vCost = parseFloat(config.Cost_Vinyl_Intermediate || "0.46");
    if (inputs.material === '751' || inputs.material === '951') vCost = parseFloat(config.Cost_Vinyl_Cast || "0.95");
    if (inputs.material.includes('85')) vCost = parseFloat(config.Cost_Vinyl_Translucent || "1.25");
    
    L(`Vinyl Media`, totalActualSqFt * vCost * parseFloat(config.Waste_Factor || "1.15"), `Actual SF * Mat Cost * Waste`);
    L(`Transfer Tape`, totalActualSqFt * parseFloat(config.Cost_Transfer_Tape || "0.15") * 1.15, `Actual SF * Mask Cost * Waste`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.05");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: unitPrint * inputs.qty }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 }) }
})