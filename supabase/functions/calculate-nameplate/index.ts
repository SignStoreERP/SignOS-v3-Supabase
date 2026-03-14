const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { inputs, config } = await req.json()
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    const getDesc = (k: string) => config['META_NOTE_' + k] || "System parameter.";
    const V = (k: string) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const C = (k: string, val: string) => `<span class="hover-var text-emerald-600 border-b border-dotted border-emerald-400 cursor-help transition-all font-bold" data-var="${k}">${val}</span>`;

    const ret: any[] = []; const cst: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total !== 0) ret.push({label, total, unit: total/inputs.qty, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total !== 0) cst.push({label, total, formula}); return total; };

    let baseRate = parseFloat(config.Retail_Price_Mattes_116 || "0.55");
    let baseKey = 'Retail_Price_Mattes_116';
    let productName = '1/16" Front Engraved';
    let isRev = false;

    if (inputs.product === 'Rev116') {
      baseRate = parseFloat(config.Retail_Price_Ultra_116 || "0.65");
      baseKey = 'Retail_Price_Ultra_116';
      productName = '1/16" Reverse Engraved';
      isRev = true;
    } else if (inputs.product === 'Rev18') {
      baseRate = parseFloat(config.Retail_Price_Ultra_18 || "0.85");
      baseKey = 'Retail_Price_Ultra_18';
      productName = '1/8" Reverse Engraved';
      isRev = true;
    }

    let rawBaseTotal = baseRate * totalSqin;
    R(`Base Plate (${productName})`, rawBaseTotal, `Qty * ${sqin.toFixed(1)} SqIn * ${V(baseKey)}`);

    let tier1Qty = parseFloat(config.Tier_1_Qty || "10");
    if (inputs.qty >= tier1Qty) {
      let discPct = parseFloat(config.Tier_1_Disc || "0.05");
      let discAmt = rawBaseTotal * discPct;
      R(`Volume Discount (${(discPct * 100).toFixed(0)}%)`, -discAmt, `Subtotal * ${V('Tier_1_Disc')}`);
    }

    let feeSetup = parseFloat(config.Retail_Fee_Setup || "0");
    if (feeSetup > 0) R(`File Setup Fee`, feeSetup, V('Retail_Fee_Setup'));

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const actualUnitPriceRaw = grandTotalRaw / inputs.qty;
    const minOrder = parseFloat(config.Retail_Min_Order || "35");
    const isMinApplied = grandTotalRaw < minOrder;
    if (isMinApplied) R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `${V('Retail_Min_Order')} - Subtotal`);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // COST ENGINE
    const wastePct = parseFloat(config.Waste_Factor || "1.10");
    const rateOp = parseFloat(config.Rate_Operator || "25");
    const rateShop = parseFloat(config.Rate_Shop_Labor || "20");
    const rateEngraver = parseFloat(config.Rate_Machine_Engraver || "10");

    let matCostKey = inputs.product === 'Rev18' ? 'Cost_Sub_ADA_Core_18' : 'Cost_Sub_ADA_Core_116';
    let matCost = inputs.product === 'Rev18' ? parseFloat(config.Cost_Sub_ADA_Core_18 || "70") : parseFloat(config.Cost_Sub_ADA_Core_116 || "50");

    L(`Rowmark Substrate`, (totalSqin * (matCost / 1152)) * wastePct, `(Total SqIn * ${V(matCostKey)} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);
    L(`Engraver Prepress`, (parseFloat(config.Time_Preflight_Job || "15") / 60) * rateOp, `${V('Time_Preflight_Job')} Mins * ${V('Rate_Operator')}`);
    L(`Engraver Handling/Load`, (parseFloat(config.Time_Engraver_Load_Per_Item || "2") * inputs.qty / 60) * rateOp, `Qty * ${V('Time_Engraver_Load_Per_Item')} Mins * ${V('Rate_Operator')}`);

    let runMins = totalSqin * parseFloat(config.Time_Engrave_SqIn || "0.25");
    L(`Engraver Run Time`, (runMins / 60) * rateEngraver, `Total SqIn * ${V('Time_Engrave_SqIn')} Mins * ${V('Rate_Machine_Engraver')}`);

    if (isRev) {
      L(`Paint Fill Material`, totalSqin * parseFloat(config.Cost_Paint_SqIn || "0.01") * wastePct, `Total SqIn * ${V('Cost_Paint_SqIn')} * ${V('Waste_Factor')}`);
      let paintMins = parseFloat(config.Time_Paint_Setup || "20") + (totalSqin * parseFloat(config.Time_Paint_SqIn || "0.1"));
      L(`Paint Labor (Mix & Fill)`, (paintMins / 60) * rateShop, `(${V('Time_Paint_Setup')} Mins + (SqIn * ${V('Time_Paint_SqIn')})) * ${V('Rate_Shop_Labor')}`);
    }

    if (inputs.mounting === 'Foam Tape') {
      let tapeCost = parseFloat(config.Cost_Hem_Tape || "0.08");
      L(`Mounting Tape (Foam VHB)`, (totalSqin * (tapeCost/144)) * wastePct, `(Total SqIn * ${V('Cost_Hem_Tape')} / ${C('C_144', '144')}) * ${V('Waste_Factor')}`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(config.Factor_Risk || "1.05");

    const payload = {
      retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, printTotal: rawBaseTotal },
      cost: { total: totalCost, breakdown: cst },
      metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }); }
});