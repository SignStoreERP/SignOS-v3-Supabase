import "@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests from the browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { inputs, config } = await req.json()

    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;

    // --- 1. RETAIL ENGINE ---
    const ret: any[] = [];
    const R = (label: string, total: number, formula: string) => { 
        if(total > 0) ret.push({label, total, formula}); 
        return total; 
    };

    const baseSS = parseFloat(config.Retail_Price_Sign_SS || 25.00);
    const adderDS = parseFloat(config.Retail_Price_Sign_DS || 2.50);
    const stk1Price = parseFloat(config.Retail_Stake_T1_Price || 2.00);

    let appliedBase = baseSS;
    if (inputs.qty >= (parseFloat(config.Tier_1_Qty) || 10)) {
        appliedBase = parseFloat(config.Tier_1_Price || 23.75);
    }

    R(`Base Print (${inputs.sides} Sided)`, appliedBase * inputs.qty, `${inputs.qty} Signs @ $${appliedBase}`);
    if (inputs.sides === 2) R(`Double Sided Adder`, adderDS * inputs.qty, `${inputs.qty} Signs @ $${adderDS}`);
    if (inputs.hasStakes) R(`H-Stakes`, stk1Price * inputs.qty, `${inputs.qty} Stakes @ $${stk1Price}`);

    let grandTotal = ret.reduce((sum, i) => sum + i.total, 0);
    let isMinApplied = false;
    const minOrder = parseFloat(config.Retail_Min_Order || 50);
    
    if (grandTotal < minOrder) {
      R(`Shop Minimum Surcharge`, minOrder - grandTotal, `Minimum order difference`);
      grandTotal = minOrder;
      isMinApplied = true;
    }

    const printTotal = (appliedBase * inputs.qty) + (inputs.sides === 2 ? adderDS * inputs.qty : 0);
    const stakeTotal = inputs.hasStakes ? stk1Price * inputs.qty : 0;

    // --- 2. PHYSICS ENGINE (HARD COST) ---
    const cst: any[] = [];
    const L = (label: string, total: number, formula: string) => { 
        if(total > 0) cst.push({label, total, formula}); 
        return total; 
    };

    const rateOp = parseFloat(config.Rate_Operator || 25);
    const wastePct = parseFloat(config.Waste_Factor || 1.15);

    L(`Coro Blanks (24x18)`, inputs.qty * parseFloat(config.Cost_Blank_Standard || 1.00) * wastePct, `${inputs.qty} Blanks * $1.00 * Waste`);
    L(`UV Ink`, totalSqFt * parseFloat(config.Cost_Ink_UV || 0.16) * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);
    if (inputs.hasStakes) L(`H-Stakes`, inputs.qty * parseFloat(config.Cost_Stake || 0.50), `${inputs.qty} Stakes * $0.50`);

    L(`Job Setup (File RIP)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Material Handling`, (5 / 60) * rateOp * multDS, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(config.Machine_Speed_LF_Hr || 25)) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(config.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(config.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(config.Factor_Risk || 1.05);

    const payload = {
      retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret, isMinApplied, printTotal, stakeTotal },
      cost: { total: totalCost, breakdown: cst },
      metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})