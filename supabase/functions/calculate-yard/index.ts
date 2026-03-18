declare const Deno: any;

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const requestData = await req.json();
    const isArray = Array.isArray(requestData.inputs);
    const inputPayload = isArray ? requestData.inputs : [requestData.inputs];
    const config = requestData.config || {};
    const auditMode = requestData.audit_mode || 'retail_only'; 

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    let dictionary: any[] = [];

    // HEADLESS FETCH: Pull from the correct ref_retail_history table
    if ((auditMode === 'full' || auditMode === 'retail_only') && supabaseUrl && supabaseKey) {
        const res = await fetch(`${supabaseUrl}/rest/v1/ref_retail_history?select=*`, { 
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } 
        });
        if (res.ok) dictionary = await res.json();
    }

    const results = inputPayload.map((inputs: any) => {
        const qty = parseFloat(inputs.qty) || 1;
        const reqSides = inputs.sides === 2 ? 2 : 1;
        const hasStakes = inputs.hasStakes === true || String(inputs.hasStakes) === 'true';
        
        const ret: any[] = [];
        const cst: any[] = [];
        
        const num = (k: string, fallback: number) => { 
            const p = parseFloat(config[k]); 
            return isNaN(p) ? fallback : p; 
        };
        
        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };

        let grandTotalRetail = 0;
        let printTotal = 0;
        let stakeTotal = 0;

        // ==========================================
        // TIER 1: RETAIL ENGINE (Strict Dictionary)
        // ==========================================
        if (auditMode === 'full' || auditMode === 'retail_only') {
            let exactPrice = 0; 
            const targetSides = reqSides === 2 ? 'Double' : 'Single';
            
            // 1. Find the 18x24 4mm Coroplast Price
            const signRow = dictionary.find((r: any) => r.product_line === '4mm Coroplast' && r.sides === targetSides && (r.dimensions === '18x24' || r.dimensions === '24x18'));
            
            if (signRow) {
                exactPrice = parseFloat(signRow.legacy_price || "0");
            } else {
                // Failsafe matching the Blue Sheet just in case the DB call fails
                exactPrice = reqSides === 2 ? 27.50 : 25.00;
            }

            // Apply 5% Bulk Discount for 10+
            if (qty >= num('Tier_1_Qty', 10)) {
                exactPrice = exactPrice * (1 - num('Tier_1_Disc', 0.05)); 
            }

            printTotal = exactPrice * qty;
            R(`Sign Print (18" x 24")`, printTotal, `${qty}x Signs @ $${exactPrice.toFixed(2)}/ea`);

            // 2. Hardware: Wire Stakes
            if (hasStakes) {
                let stkRate = 2.00;
                const stakeRow = dictionary.find((r: any) => r.product_line === 'Wire Stakes' || (r.dimensions === '10x30' && r.category === 'Hardware'));
                
                if (stakeRow) {
                    stkRate = parseFloat(stakeRow.legacy_price || "2.00");
                }
                
                // Blue Sheet specific volume rule for Stakes (100+ = $1.50)
                if (qty >= 100) stkRate = 1.50; 

                stakeTotal = stkRate * qty;
                R(`Standard H-Stakes`, stakeTotal, `${qty}x Stakes @ $${stkRate.toFixed(2)}/ea`);
            }
            
            let grandTotalRetailRaw = printTotal + stakeTotal;
            const minOrder = num('Retail_Min_Order', 50);
            grandTotalRetail = grandTotalRetailRaw;
            let isMinApplied = false;

            // 3. Shop Minimum Enforcement
            if (grandTotalRetailRaw < minOrder) {
                R(`Shop Minimum Surcharge`, minOrder - grandTotalRetailRaw, `Minimum order difference`);
                grandTotalRetail = minOrder; 
                isMinApplied = true;
            }
        }

        return { 
            retail: { unitPrice: grandTotalRetail / qty, grandTotal: grandTotalRetail, breakdown: ret, isMinApplied: grandTotalRetail > (printTotal + stakeTotal) }, 
            cost: { total: 0, breakdown: [] }, // Cost bypassed for now
            metrics: { margin: 0 } 
        };
    });

    const finalPayload = isArray ? results : results.shift();
    return new Response(JSON.stringify(finalPayload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) { 
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders }); 
  }
});