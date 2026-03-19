import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export const Agent_Retail_Market = {
    evaluateCurve: async (productLine: string, sqft: number, authHeader: string) => {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: curves, error } = await supabase
            .from('retail_curves')
            .select('*')
            .eq('product_line', productLine);

        if (error || !curves || curves.length === 0) {
            throw new Error(`[NO FALLBACK MANDATE] No retail curves found for Product Line [${productLine}].`);
        }

        // Evaluate the tiered curve based on the SqFt bounding
        const activeCurve = curves.find((c: any) => 
            sqft >= parseFloat(c.sqft_min) && sqft <= parseFloat(c.sqft_max)
        );

        if (!activeCurve) {
            throw new Error(`[NO FALLBACK MANDATE] SqFt [${sqft}] falls outside defined retail tiers for [${productLine}].`);
        }

        const pricePerSqFt = parseFloat(activeCurve.price_per_sqft) || 0;
        const hardMin = parseFloat(activeCurve.min_price) || 0;

        const calculatedTotal = sqft * pricePerSqFt;
        const retailValue = Math.max(calculatedTotal, hardMin);

        return {
            productLine: productLine,
            sqftBilled: sqft,
            tierActivated: activeCurve.condition || 'Volume Pricing',
            pricePerSqFt: pricePerSqFt,
            hardMinimum: hardMin,
            finalRetailValue: retailValue
        };
    }
};