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
            fetch(`${supabaseUrl}/rest/v1/ref_retail_history?product_line=ilike.*Banner*&select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
            fetch(`${supabaseUrl}/rest/v1/retail_curves?select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } })
        ]);
        if (resDict.ok) dictionary = await resDict.json();
        if (resCurves.ok) curves = await resCurves.json();
    }

    const results = inputPayload.map((inputs: any) => {
        const reqW = parseFloat(inputs.w) || 72;
        const reqH = parseFloat(inputs.h) || 36;
        const qty = parseFloat(inputs.qty) || 1;
        const reqSides = inputs.sides === 2 ? 2 : 1;
        
        const ret: any[] = [];
        const num = (k: string, fallback: number) => { const p = parseFloat(config[k]); return isNaN(p) ? fallback : p; };
        const R = (label: string, total: number, formula: string) => { if (total !== 0) ret.push({label, total, formula}); return total; };

        let grandTotalRetail = 0;
        let baseUnitPrice = 0; // Isolated to prevent finishing fees from bleeding into the UI Unit Price
        let isMinApplied = false;

        if (auditMode === 'full' || auditMode === 'retail_only') {
            let exactPrice = 0; 
            let mappedBox = "";
            
            // Convert inches to feet for dictionary matching (e.g. 72"x36" -> "6x3" or "3x6")
            const feetW = Math.round(reqW / 12);
            const feetH = Math.round(reqH / 12);
            const searchDim1 = `${feetW}x${feetH}`;
            const searchDim2 = `${feetH}x${feetW}`;
            
            const targetSides = reqSides === 2 ? 'Double' : 'Single';
            const validRows = dictionary.filter((r: any) => r.product_line === '13oz Banner' && r.sides === targetSides);
            
            for (const row of validRows) {
                if (row.dimensions === searchDim1 || row.dimensions === searchDim2) {
                    mappedBox = row.dimensions;
                    exactPrice = parseFloat(row.legacy_price || "0");
                    break;
                }
            }
            
            let unitPrice = 0;
            let isMapped = false;
            const billedSqFt = (reqW * reqH) / 144;
            
            if (exactPrice > 0) {
                unitPrice = exactPrice; 
                isMapped = true;
            } else {
                const activeCurve = curves.find((c: any) => c.product_line.includes('13oz Banner') && billedSqFt >= c.sqft_min && billedSqFt <= c.sqft_max);
                let baseRate = num('Retail_Price_Base_13oz', 5.00);
                if (activeCurve) baseRate = parseFloat(activeCurve.price_per_sqft || "0");

                let rawUnitPrint = Math.max(baseRate * billedSqFt, activeCurve ? parseFloat(activeCurve.min_price || "0") : 0);
                unitPrice = rawUnitPrint + (reqSides === 2 ? rawUnitPrint * num('Retail_Adder_DS_Mult', 0.5) : 0);
            }

            // Apply Bulk Discount (10+)
            if (qty >= num('Tier_1_Qty', 10)) unitPrice = unitPrice * (1 - num('Tier_1_Disc', 0.05)); 
            
            baseUnitPrice = unitPrice; // Lock the pure banner cost for the UI
            let printTotal = unitPrice * qty;
            R(isMapped ? `Banner Print (Mapped to ${mappedBox}ft)` : `Custom Banner (${reqW}"x${reqH}")`, printTotal, `${qty}x Banners @ $${unitPrice.toFixed(2)}/ea`);

            // Finishing Fees
            let finishingFee = 0;
            if (inputs.pockets && inputs.pockets !== 'None') {
                const pktRate = num('Retail_Fee_PolePkt', 2.00);
                let pktLF = (reqW / 12);
                if (inputs.pockets === 'TopBottom') pktLF *= 2;
                let pocketTotal = pktLF * pktRate * qty;
                R(`Pole Pockets (${inputs.pockets})`, pocketTotal, `${qty}x Banners * ${pktLF.toFixed(1)} LF @ $${pktRate.toFixed(2)}/LF`);
                finishingFee += pocketTotal;
            }
            
            if (inputs.windSlits === 'Yes') {
                const slitRate = num('Retail_Fee_WindSlit', 2.00);
                let slitTotal = billedSqFt * slitRate * qty;
                R(`Wind Slits`, slitTotal, `${qty}x Banners * ${billedSqFt.toFixed(1)} SF @ $${slitRate.toFixed(2)}/SF`);
                finishingFee += slitTotal;
            }
            
            let grandTotalRetailRaw = printTotal + finishingFee;
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