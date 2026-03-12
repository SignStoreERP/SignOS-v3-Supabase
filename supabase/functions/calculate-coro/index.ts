import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { inputs, config } = await req.json()
    
    // 1. Extract inputs
    const qty = inputs.qty || 1;
    const w = inputs.w || 24;
    const h = inputs.h || 18;
    const thickness = inputs.thickness || '4mm';
    const sides = inputs.sides || 1;
    const shape = inputs.shape || 'Rectangle';

    // 2. Physics & Math
    const sqftPerSign = (w * h) / 144;
    const totalSqft = sqftPerSign * qty;
    
    // Tiered pricing logic 
    let baseSqftPrice = thickness === '10mm' ? 25.00 : 8.33; 
    if (totalSqft >= 32) baseSqftPrice = thickness === '10mm' ? 15.00 : 5.00;
    
    let unitPrice = sqftPerSign * baseSqftPrice;

    // Double Sided Multiplier (Pulls from DB override, defaults to 50% markup)
    if (sides === 2) {
      const dsMult = config?.Retail_Adder_DS_Mult || 0.5;
      unitPrice += (unitPrice * dsMult);
    }

    let printTotal = unitPrice * qty;
    let routerFee = 0;

    // CNC Router Math
    if (shape !== 'Rectangle') {
      const cncTimeSqft = shape === 'CNC Complex' ? 
        (config?.Time_CNC_Complex_SqFt || 2) : 
        (config?.Time_CNC_Easy_SqFt || 1);
        
      // Assuming $110/hr shop rate for CNC
      const cncRatePerMin = 110 / 60; 
      const timeMins = totalSqft * cncTimeSqft;
      routerFee = timeMins * cncRatePerMin;
    }

    let grandTotal = printTotal + routerFee;

    // Shop Minimum Guardrail
    const minOrder = config?.Retail_Min_Order || 50;
    let isMinApplied = false;
    if (grandTotal < minOrder) {
      grandTotal = minOrder;
      isMinApplied = true;
      unitPrice = grandTotal / qty; // Backwards calculate the unit price
    }

    // 3. Return Standardized Payload matching your schema rules
    const responsePayload = {
      retail: {
        unitPrice: unitPrice,
        grandTotal: grandTotal,
        printTotal: printTotal,
        routerFee: routerFee,
        isMinApplied: isMinApplied
      },
      cost: { total: 0 },
      metrics: { margin: 0.50 }
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})