const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { inputs, config } = await req.json()
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const ret: any[] = []; const cst: any[] = [];
    
    // Modifying the R function to accept $0 line items
    const R = (label: string, total: number, formula: string) => { ret.push({label, total, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total > 0) cst.push({label, total, formula}); return total; };

    let baseRate = 8;
    switch(inputs.material) {
        case 'Cast': baseRate = parseFloat(config.Retail_Price_Cast_SqFt || "14"); break;
        case 'Reflective': baseRate = parseFloat(config.Retail_Price_Reflective_SqFt || "15"); break;
        case 'Clear': baseRate = parseFloat(config.Retail_Price_Clear_SqFt || "10"); break;
        case 'Translucent': baseRate = parseFloat(config.Retail_Price_Trans_SqFt || "10"); break;
        default: baseRate = parseFloat(config.Retail_Price_Cal_SqFt || "8");
    }

    R(`Printed Vinyl (${inputs.material})`, baseRate * totalSqFt, `${totalSqFt.toFixed(1)} SF @ $${baseRate}`);
    if (inputs.shape === 'Contour') R(`Contour Cut Markup`, (baseRate * totalSqFt) * parseFloat(config.Retail_Cut_Contour_Add || "0.25"), `Shape Surcharge`);
    
    // FIXED: Enforce simple/complex weeding logic for decals
    if (inputs.weeding === 'Complex') {
        const weedFee = parseFloat(config.Retail_Weed_Complex_Add || "5");
        R(`Complex Weeding`, totalSqFt * weedFee, `${totalSqFt.toFixed(1)} SF @ $${weedFee.toFixed(2)}`);
    } else {
        R(`Standard Weeding`, 0, `Included in base rate`);
    }

    // FIXED: Retail charge is $0 (Included), but cost engine will still calculate the material
    if (inputs.masking === 'Yes') {
        R(`Transfer Tape`, 0, `Included in base rate`);
    }
    
    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "50");
    let isMinApplied = false; let grandTotal = grandTotalRaw;
    if (grandTotalRaw < minOrder) { R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Difference`); grandTotal = minOrder; isMinApplied = true; }

    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    L(`Vinyl Media`, totalSqFt * parseFloat(config.Cost_Vin_Cal || "0.36") * wastePct, `Media Cost`);
    L(`Latex Ink`, totalSqFt * parseFloat(config.Cost_Ink_Latex || "0.16"), `Ink Cost`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.05");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: baseRate * totalSqFt }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }) }
})