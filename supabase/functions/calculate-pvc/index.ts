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
    let curves: any[] = [];

    // HEADLESS FETCH: Pull from the correct ref_retail_history table
    if ((auditMode === 'full' || auditMode === 'retail_only') && supabaseUrl && supabaseKey) {
        const [resDict, resCurves] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/ref_retail_history?select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
            fetch(`${supabaseUrl}/rest/v1/retail_curves?select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } })
        ]);
        if (resDict.ok) dictionary = await resDict.json();
        if (resCurves.ok) curves = await resCurves.json();
    }

    const results = inputPayload.map((inputs: any) => {
        const reqW = parseFloat(inputs.w) || 24;
        const reqH = parseFloat(inputs.h) || 18;
        const qty = parseFloat(inputs.qty) || 1;
        const reqSides = inputs.sides === 2 ? 2 : 1;
        const thk = String(inputs.thickness || '3mm');
        const is6mm = thk.includes('6');
        
        const ret: any[] = [];
        
        const num = (k: string, fallback: number) => { 
            const p = parseFloat(config[k]); 
            return isNaN(p) ? fallback : p; 
        };
        
        const R = (label: string, total: number, formula: string) => { if (total !== 0) ret.push({label, total, formula}); return total; };

        let grandTotalRetail = 0;
        let printTotal = 0;
        let routerFee = 0;

        // ==========================================
        // TIER 1: RETAIL ENGINE (Strict Dictionary)
        // ==========================================
        if (auditMode === 'full' || auditMode === 'retail_only') {
            let exactPrice = 0; 
            let mappedBox = "";
            let bestArea = Infinity; 
            
            const targetLine = is6mm ? '6mm PVC' : '3mm PVC';
            const targetSides = reqSides === 2 ? 'Double' : 'Single';
            const validRows = dictionary.filter((r: any) => r.product_line === targetLine && r.sides === targetSides);
            
            for (const row of validRows) {
                if (!row.dimensions || !row.dimensions.includes('x')) continue;
                const [swStr, shStr] = row.dimensions.toLowerCase().split('x');
                const sw = parseFloat(swStr); 
                const sh = parseFloat(shStr); 
                
                const fitsStandard = (sw >= reqW && sh >= reqH);
                const fitsRotated = (sh >= reqW && sw >= reqH);
                
                if (fitsStandard || fitsRotated) {
                    const area = sw * sh;
                    if (area < bestArea) {
                        bestArea = area; 
                        mappedBox = row.dimensions;
                        exactPrice = parseFloat(row.legacy_price || "0");
                    }
                }
            }
            
            let unitPrice = 0;
            let isMapped = false;
            let billedSqFt = 0;
            const billedW = Math.ceil(reqW / 12) * 12;
            const billedH = Math.ceil(reqH / 12) * 12;
            
            if (exactPrice > 0) {
                unitPrice = exactPrice;
                isMapped = true;
            } else {
                // ARCHITECTURAL FALLBACK: Dynamic Market Area Curves
                billedSqFt = (billedW * billedH) / 144;
                
                let baseRate = 0;
                let minSignPrice = 0;

                const activeCurve = curves.find((c: any) => c.product_line === targetLine && billedSqFt >= c.sqft_min && billedSqFt <= c.sqft_max);
                
                if (activeCurve) {
                    baseRate = parseFloat(activeCurve.price_per_sqft || "0");
                    minSignPrice = parseFloat(activeCurve.min_price || "0");
                } else {
                    throw new Error(`Missing Retail Curve in DB for ${targetLine} at ${billedSqFt} SqFt`);
                }

                let rawUnitPrint = baseRate * billedSqFt;
                if (rawUnitPrint < minSignPrice) {
                    rawUnitPrint = minSignPrice;
                }

                let rawUnitDS = reqSides === 2 ? rawUnitPrint * num('Retail_Adder_DS_Mult', 0.5) : 0;
                unitPrice = rawUnitPrint + rawUnitDS;
            }

            // 1. Apply Bulk Discount for 10+
            if (qty >= num('Tier_1_Qty', 10)) {
                unitPrice = unitPrice * (1 - num('Tier_1_Disc', 0.05)); 
            }

            // 2. Apply Laminate Deduction (-10%)
            let lamDeductVal = 0;
            if (inputs.laminate === 'None') {
                const lamDeductPct = num('Retail_Lam_Deduct', 0.10);
                lamDeductVal = unitPrice * lamDeductPct;
                unitPrice = unitPrice - lamDeductVal;
            }

            printTotal = unitPrice * qty;
            
            if (isMapped) {
                R(`Sign Print (${thk} Mapped to ${mappedBox})`, printTotal, `${qty}x Signs @ $${unitPrice.toFixed(2)}/ea`);
            } else {
                R(`Base Print (${thk} Billed at ${billedW}"x${billedH}")`, printTotal, `${qty}x Signs @ $${unitPrice.toFixed(2)}/ea`);
            }

            // 3. Routing Fees
            if (inputs.shape === 'CNC Simple') {
                routerFee = num('Retail_Fee_Router_Easy', 30);
                R(`CNC Router Fee`, routerFee, `Simple Shape Fee`);
            } else if (inputs.shape === 'CNC Complex') {
                routerFee = num('Retail_Fee_Router_Hard', 50);
                R(`CNC Router Fee`, routerFee, `Complex Shape Fee`);
            }
            
            let grandTotalRetailRaw = printTotal + routerFee;
            const minOrder = num('Retail_Min_Order', 50);
            grandTotalRetail = grandTotalRetailRaw;
            let isMinApplied = false;

            // 4. Shop Minimum Enforcement
            if (grandTotalRetailRaw < minOrder) {
                R(`Shop Minimum Surcharge`, minOrder - grandTotalRetailRaw, `Minimum order difference`);
                grandTotalRetail = minOrder; 
                isMinApplied = true;
            }
        }

        return { 
            retail: { unitPrice: grandTotalRetail / qty, grandTotal: grandTotalRetail, breakdown: ret, isMinApplied }, 
            cost: { total: 0, breakdown: [] }, // Bypassed for retail rollout
            metrics: { margin: 0 } 
        };
    });

    const finalPayload = isArray ? results : results.shift();
    return new Response(JSON.stringify(finalPayload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) { 
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders }); 
  }
});