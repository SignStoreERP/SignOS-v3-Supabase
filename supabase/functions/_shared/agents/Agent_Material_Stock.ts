import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export const Agent_Material_Stock = {

    // 1. SECURE DATABASE FETCHER
    fetchMaterial: async (sku: string, authHeader: string) => {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        // Enforce RLS by passing the frontend's Bearer token
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // FIX: Removed width_in and length_in to match the actual database schema
        const { data: mat, error } = await supabase
            .from('materials')
            .select(`
                sku, 
                description, 
                uom, 
                waste_factor, 
                material_costs_history ( internal_cost, effective_from )
            `)
            .eq('sku', sku)
            .order('effective_from', { foreignTable: 'material_costs_history', ascending: false })
            .limit(1, { foreignTable: 'material_costs_history' })
            .single();

        if (error || !mat) {
            console.error("Supabase Error:", error);
            throw new Error(`[NO FALLBACK MANDATE] Material SKU [${sku}] not found or access blocked. Supabase Error: ${error?.message || 'Unknown'}`);
        }

        // Extract the relational cost
        let latestCost = 0;
        if (Array.isArray(mat.material_costs_history) && mat.material_costs_history.length > 0) {
            latestCost = mat.material_costs_history.internal_cost;
        } else if (mat.material_costs_history && !Array.isArray(mat.material_costs_history)) {
            latestCost = (mat.material_costs_history as any).internal_cost;
        }

        if (!latestCost || latestCost <= 0) {
            throw new Error(`[NO FALLBACK MANDATE] Zero or missing cost history for SKU [${sku}]. Cost drift prevented.`);
        }

        mat.internal_cost = latestCost;
        return mat;
    },

    // 2. LINEAR MEDIA PHYSICS (Extrusions, Tubes, Angles)
    calculateLinearYield: (reqLF: number, qty: number, material: any, stickLengthLF: number) => {
        const totalReqLF = reqLF * qty;
        const sticksNeeded = Math.ceil(totalReqLF / stickLengthLF);
        const totalLF = sticksNeeded * stickLengthLF;
        const dropLF = totalLF - totalReqLF;
        const wasteFactor = parseFloat(material.waste_factor) || 1.0;
        
        return {
            sticksNeeded,
            totalLF,
            dropLF,
            wasteFactor,
            costPerLF: material.internal_cost,
            totalCost: totalLF * material.internal_cost * wasteFactor
        };
    },

    // 3. RIGID MEDIA PHYSICS (Bounding Box Math)
    calculateSheetYield: (reqW: number, reqH: number, qty: number, material: any, sheetW = 48, sheetH = 96) => {
        const fitA_Cols = Math.floor(sheetW / reqW);
        const fitA_Rows = Math.floor(sheetH / reqH);
        const yieldA = fitA_Cols * fitA_Rows;

        const fitB_Cols = Math.floor(sheetW / reqH);
        const fitB_Rows = Math.floor(sheetH / reqW);
        const yieldB = fitB_Cols * fitB_Rows;

        const bestYieldPerSheet = Math.max(yieldA, yieldB, 1);
        const sheetsNeeded = Math.ceil(qty / bestYieldPerSheet);
        
        const totalSqFt = sheetsNeeded * ((sheetW * sheetH) / 144);
        const reqSqFt = ((reqW * reqH) / 144) * qty;
        const dropSqFt = totalSqFt - reqSqFt;
        const wasteFactor = parseFloat(material.waste_factor) || 1.0;

        return {
            sheetsNeeded,
            sheetW,
            sheetH,
            yieldPerSheet: bestYieldPerSheet,
            totalSqFt,
            dropSqFt,
            wasteFactor,
            costPerSheet: material.internal_cost,
            totalCost: sheetsNeeded * material.internal_cost * wasteFactor
        };
    }
};