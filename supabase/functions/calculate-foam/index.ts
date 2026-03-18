declare const Deno: any;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const requestData = await req.json();
    const inputPayload = Array.isArray(requestData.inputs) ? requestData.inputs : [requestData.inputs];
    const config = requestData.config || {};
    const auditMode = requestData.audit_mode || 'retail_only'; 

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    let dictionary: any[] = [];
    let curves: any[] = [];

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
        
        const ret: any[] = [];
        const num = (k: string, fallback: number) => { const p = parseFloat(config[k]); return isNaN(p) ? fallback : p; };
        const R = (label: string, total: number, formula: string) => { if (total !== 0) ret.push({label, total, formula}); return total; };

        let grandTotalRetail = 0;
        let baseUnitPrice = 0; // Isolated to prevent router fees from bleeding into the UI Unit Price
        let isMinApplied = false;

        if (auditMode === 'full' || auditMode === 'retail_only') {
            let exactPrice = 0; 
            let mappedBox = "";
            let bestArea = Infinity; 
            
            const targetLine = '3/16" Foam Core';
            const targetSides = reqSides === 2 ? 'Double' : 'Single';
            const validRows = dictionary.filter((r: any) => r.product_line === targetLine && r.sides === targetSides);
            
            for (const row of validRows) {
                if (!row.dimensions || !row.dimensions.includes('x')) continue;
                const [swStr, shStr] = row.dimensions.toLowerCase().split('x');
                const sw = parseFloat(swStr); const sh = parseFloat(shStr); 
                
                if ((sw >= reqW && sh >= reqH) || (sh >= reqW && sw >= reqH)) {
                    const area = sw * sh;
                    if (area < bestArea) {
                        bestArea = area; mappedBox = row.dimensions; exactPrice = parseFloat(row.legacy_price || "0");
                    }
                }
            }
            
            let unitPrice = 0;
            let isMapped = false;
            let billedSqFt = 0;
            const billedW = Math.ceil(reqW / 12) * 12;
            const billedH = Math.ceil(reqH / 12) * 12;
            
            if (exactPrice > 0) {
                unitPrice = exactPrice; isMapped = true;
            } else {
                billedSqFt = (billedW * billedH) / 144;
                const activeCurve = curves.find((c: any) => c.product_line === '3/16 Foam' && billedSqFt >= c.sqft_min && billedSqFt <= c.sqft_max);
                
                if (!activeCurve) throw new Error(`Missing Retail Curve in DB for Foam Core`);
                let rawUnitPrint = Math.max(parseFloat(activeCurve.price_per_sqft || "0") * billedSqFt, parseFloat(activeCurve.min_price || "0"));
                unitPrice = rawUnitPrint + (reqSides === 2 ? rawUnitPrint * num('Retail_Adder_DS_Mult', 0.5) : 0);
            }

            // Apply Bulk Discount (10+)
            if (qty >= num('Tier_1_Qty', 10)) unitPrice = unitPrice * (1 - num('Tier_1_Disc', 0.05)); 
            
            baseUnitPrice = unitPrice; // Lock the pure sign cost for the UI
            let printTotal = unitPrice * qty;
            R(isMapped ? `Sign Print (3/16" Mapped to ${mappedBox})` : `Base Print (3/16" Billed at ${billedW}"x${billedH}")`, printTotal, `${qty}x Signs @ $${unitPrice.toFixed(2)}/ea`);

            // Routing Fees
            let routerFee = 0;
            if (inputs.shape === 'CNC Simple') routerFee = num('Retail_Fee_Router_Easy', 30);
            else if (inputs.shape === 'CNC Complex') routerFee = num('Retail_Fee_Router_Hard', 50);
            if (routerFee > 0) R(`CNC Router Fee`, routerFee, `Shape Fee`);
            
            let grandTotalRetailRaw = printTotal + routerFee;
            const minOrder = num('Retail_Min_Order', 50);
            grandTotalRetail = grandTotalRetailRaw;

            // Shop Minimum
            if (grandTotalRetailRaw < minOrder) {
                R(`Shop Minimum Surcharge`, minOrder - grandTotalRetailRaw, `Minimum order difference`);
                grandTotalRetail = minOrder; isMinApplied = true;
            }
        }

        return { 
            retail: { unitPrice: baseUnitPrice, grandTotal: grandTotalRetail, breakdown: ret, isMinApplied }, 
            cost: { total: 0, breakdown: [] }, 
            metrics: { margin: 0 } 
        };
    });

    return new Response(JSON.stringify(Array.isArray(requestData.inputs) ? results : results.shift()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders }); }
});