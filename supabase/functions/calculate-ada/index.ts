import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Required CORS headers for browser requests
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
    // 1. Parse the incoming Handshake (Inputs from UI + Config from DB)
    const { inputs, config } = await req.json()
    const { qty = 1, w = 8, h = 8, layers = [], mounting = 'None' } = inputs

    const sqIn = w * h;
    const totalSqIn = sqIn * qty;

    // --- ENGINE 1: PHYSICS (HARD COST) ---
    let totalHardCost = 0;
    const costBreakdown = [];

    // Extract global cost variables (using safe fallbacks)
    const costLaborHr = config.Rate_Shop_Labor || 20; 
    const costPerMin = costLaborHr / 60;
    const wasteFactor = config.Waste_Factor || 1.10;

    // A. Material Yield Loop
    let materialCost = 0;
    layers.forEach((layer: any) => {
        let costPerSqIn = 0;
        // Map substrate types to baseline costs
        if (layer.type === 'Tactile') costPerSqIn = 0.05; 
        else if (layer.type.includes('Core')) costPerSqIn = 0.04;
        else if (layer.type === '3mm PVC Backer') costPerSqIn = 0.02;
        else if (layer.type.includes('Clear Acrylic')) costPerSqIn = 0.03;

        let layerCost = sqIn * costPerSqIn * qty * wasteFactor;
        materialCost += layerCost;
        
        costBreakdown.push({ 
            label: `Material: ${layer.type}`, 
            total: layerCost, 
            formula: `${sqIn} sqin * $${costPerSqIn}/sqin * ${qty} (x${wasteFactor} Waste)` 
        });
    });
    totalHardCost += materialCost;

    // B. Labor Yield (Routing, Weeding, Assembly)
    // Physical assumption: 2 mins of handling per layer, per sign
    let laborMins = (layers.length * 2) * qty; 
    let laborCost = laborMins * costPerMin;
    
    costBreakdown.push({ 
        label: "Labor (Routing & Assembly)", 
        total: laborCost, 
        formula: `${laborMins} mins * $${costPerMin.toFixed(2)}/min` 
    });
    totalHardCost += laborCost;


    // --- ENGINE 2: MARKET (RETAIL) ---
    let grandTotalRetail = 0;
    const retailBreakdown = [];

    // Base retail rate per sq inch scales based on complexity of layers
    let retailPerSqIn = config.Retail_Price_ADA_Base || 1.25; 
    if (layers.some((l: any) => l.type === 'Tactile')) retailPerSqIn += 0.50; // Braille Adder
    if (layers.some((l: any) => l.type.includes('Backer'))) retailPerSqIn += 0.25; // Stacking Adder

    let baseRetail = sqIn * retailPerSqIn * qty;
    retailBreakdown.push({ 
        label: "ADA Signage Base", 
        total: baseRetail, 
        formula: `${sqIn} sqin * $${retailPerSqIn.toFixed(2)}/sqin * ${qty}` 
    });
    grandTotalRetail += baseRetail;

    // Hardware Adders
    if (mounting === 'Foam Tape') {
        let tapeRetail = 1.50 * qty;
        retailBreakdown.push({ 
            label: "Foam Tape (VHB) Mounting", 
            total: tapeRetail, 
            formula: `$1.50 * ${qty}` 
        });
        grandTotalRetail += tapeRetail;
    }

    // Shop Minimum Guardrail
    const shopMin = config.Retail_Min_Order || 35;
    let isMinApplied = false;
    if (grandTotalRetail < shopMin) {
        retailBreakdown.push({ 
            label: "Shop Minimum Surcharge", 
            total: shopMin - grandTotalRetail, 
            formula: `Minimum $${shopMin} enforced` 
        });
        grandTotalRetail = shopMin;
        isMinApplied = true;
    }

    // --- RETURN PAYLOAD ---
    // Safely structure variables to match the front-end UI mapping
    const payload = {
      retail: {
        unitPrice: grandTotalRetail / qty,
        grandTotal: grandTotalRetail,
        printTotal: grandTotalRetail, 
        isMinApplied: isMinApplied,
        breakdown: retailBreakdown
      },
      cost: {
        total: totalHardCost,
        breakdown: costBreakdown
      },
      metrics: {
        margin: (grandTotalRetail - totalHardCost) / grandTotalRetail,
        markup: grandTotalRetail / totalHardCost
      }
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});