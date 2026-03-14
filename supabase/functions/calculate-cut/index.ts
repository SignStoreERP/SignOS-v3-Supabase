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

    let baseRate = parseFloat(config.Retail_Price_751 || "18.00");
    if (inputs.material === 'Vehicle') baseRate = parseFloat(config.Retail_Price_951 || "22");
    else if (inputs.material === 'Backlit_8500') baseRate = parseFloat(config.Retail_Price_8500 || "20");
    else if (inputs.material === 'Backlit_8800') baseRate = parseFloat(config.Retail_Price_8800 || "25");

    R(`Cut Vinyl (${inputs.material})`, baseRate * totalSqFt, `${totalSqFt.toFixed(1)} SF @ $${baseRate}`);
    if (inputs.complexity === 'Complex') R(`Complex Weeding Markup`, totalSqFt * parseFloat(config.Retail_Weed_Complex_Add || "5"), `${totalSqFt.toFixed(1)} SF @ $5.00`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(config.Retail_Min_Order || "45");
    let isMinApplied = false; let grandTotal = grandTotalRaw;
    if (grandTotalRaw < minOrder) { R(`Shop Minimum`, minOrder - grandTotalRaw, `Difference`); grandTotal = minOrder; isMinApplied = true; }

    let costVinylRaw = parseFloat(config.Cost_Vinyl_751 || "0.95");
    if (inputs.material === 'Vehicle') costVinylRaw = parseFloat(config.Cost_Vinyl_951 || "1.25");
    else if (inputs.material === 'Backlit_8500') costVinylRaw = parseFloat(config.Cost_Vinyl_8500 || "1.25");
    else if (inputs.material === 'Backlit_8800') costVinylRaw = parseFloat(config.Cost_Vinyl_8800 || "1.60");

    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    L(`Plotter Vinyl (${inputs.material})`, totalSqFt * costVinylRaw * wastePct, `${totalSqFt.toFixed(1)} SF * $${costVinylRaw}/SF * ${wastePct} Waste`);
    L(`Transfer Tape (Pre-Mask)`, totalSqFt * parseFloat(config.Cost_Transfer_Tape || "0.15") * wastePct, `${totalSqFt.toFixed(1)} SF * $0.15/SF * Waste`);

    const rateOp = parseFloat(config.Rate_Operator || "25");
    const rateShop = parseFloat(config.Rate_Shop_Labor || "20");

    L(`Job Setup (File Pathing)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    const cutHrs = totalSqFt / parseFloat(config.Speed_Cut_Graphtec || "50");
    L(`Plotter Run`, cutHrs * parseFloat(config.Rate_Machine_Cut || "5"), `${cutHrs.toFixed(2)} Hrs * $5/hr`);
    L(`Plotter Load Labor`, cutHrs * rateOp * 0.25, `${cutHrs.toFixed(2)} Hrs * $${rateOp}/hr * 25%`);

    const weedSpeed = inputs.complexity === 'Complex' ? parseFloat(config.Time_Weed_Complex || "8") : parseFloat(config.Time_Weed_Simple || "2");
    L(`Weeding Labor`, ((totalSqFt * weedSpeed) / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * ${weedSpeed} Mins/SF * $${rateShop}/hr`);
    L(`Masking Labor`, ((totalSqFt * parseFloat(config.Time_Mask_SqFt || "1")) / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 1 Min/SF * $${rateShop}/hr`);

    const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
    L(`Hand Trimming (Perimeter)`, (perimeterLF * inputs.qty * parseFloat(config.Time_Cut_Hand || "0.25") / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);

    const totalCost = cst.reduce((sum, i) => sum + i.total, 0) * parseFloat(config.Factor_Risk || "1.05");
    const payload = { retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: grandTotalRaw }, cost: { total: totalCost, breakdown: cst }, metrics: { margin: (grandTotal - totalCost) / grandTotal } };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }) }
})