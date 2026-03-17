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

    // BANNERS ARE BILLED IN 12" FEET BRACKETS
    const billedW = Math.ceil(inputs.w / 12) * 12;
    const billedH = Math.ceil(inputs.h / 12) * 12;
    const billedSqFt = (billedW * billedH) / 144;
    const totalBilledSqFt = billedSqFt * inputs.qty;

    const ret: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRate = 5.00;
    if (inputs.material && inputs.material !== '13oz') {
        baseRate = inputs.material === '15oz' ? 6.50 : (inputs.material === '18oz' ? 8.00 : 7.00);
    } else {
        if (billedSqFt < 10) baseRate = parseFloat(config.BAN13_T2_Rate || "6");
        else baseRate = parseFloat(config.BAN13_T3_Rate || "5");
    }

    let unitPrint = baseRate * billedSqFt;
    
    // Tiny Banners (1x2, 1x3, 1x4) have a $25 Base Unit Min
    if (unitPrint < 25 && inputs.material === '13oz') {
        unitPrint = 25;
        R(`Printed Banner (${inputs.material || '13oz'})`, unitPrint * inputs.qty, `${inputs.qty}x Banners @ $25 Unit Minimum`);
    } else {
        R(`Printed Banner (${inputs.material || '13oz'})`, unitPrint * inputs.qty, `${inputs.qty}x Banners (${billedSqFt} Billed SF) @ $${baseRate}`);
    }

    if (inputs.sides === 2) {
        R(`Double Sided Adder`, (parseFloat(config.Retail_Adder_DS_SqFt || "3.00") * totalBilledSqFt), `Side 2 Markup ($3/sf)`);
    }

    if (inputs.pockets === 'Top') R(`Pole Pockets (Top)`, (inputs.w / 12) * parseFloat(config.Retail_Fin_PolePkt_LF || "3") * inputs.qty, `Top Pocket`);
    else if (inputs.pockets === 'TopBottom') R(`Pole Pockets (T/B)`, ((inputs.w * 2) / 12) * parseFloat(config.Retail_Fin_PolePkt_LF || "3") * inputs.qty, `T/B Pockets`);
    
    if (inputs.windSlits === 'Yes') R(`Wind Slits`, parseFloat(config.Retail_Fee_WindSlit || "10") * inputs.qty, `Slit Markup`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "50");
    let isMinApplied = false; let grandTotal = grandTotalRaw;

    if (grandTotalRaw < minOrder) { 
        R(`Shop Minimum`, minOrder - grandTotalRaw, `Difference`); 
        grandTotal = minOrder; isMinApplied = true; 
    }

    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };
    const wastePct = parseFloat(config.Waste_Factor || "1.15");

    L(`Banner Media`, totalActualSqFt * parseFloat(config.Cost_Media_13oz || "0.26") * wastePct, `Actual Media Area * Waste`);
    L(`Latex Ink`, totalActualSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * (inputs.sides === 2 ? 2 : 1), `Actual Ink Area`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.05");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: unitPrint * inputs.qty }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 400 }) }
})