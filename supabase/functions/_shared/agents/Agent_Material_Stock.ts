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

        // Query the live materials database
        const { data: mat, error } = await supabase
            .from('materials')
            .select('sku, description, uom, waste_factor, internal_cost, width_in, length_in')
            .eq('sku', sku)
            .single();

        if (error || !mat) {
            throw new Error(`[NO FALLBACK MANDATE] Material SKU [${sku}] not found in database. Calculation halted.`);
        }

        if (!mat.internal_cost || mat.internal_cost <= 0) {
            throw new Error(`[NO FALLBACK MANDATE] Zero or missing cost for SKU [${sku}]. Cost drift prevented.`);
        }

        return mat;
    },

    // 2. RIGID MEDIA PHYSICS (Bounding Box Math)
    calculateRigidYield: (reqW: number, reqH: number, qty: number, material: any) => {
        // Detect sheet size. Fallback to 48x96 if DB columns are blank.
        let sheetW = parseFloat(material.width_in) || 48;
        let sheetH = parseFloat(material.length_in) || 96;

        // Auto-detect oversized sheets if the description/SKU implies it
        const desc = (material.description || "").toLowerCase();
        const sku = (material.sku || "").toLowerCase();
        if (desc.includes('4x10') || sku.includes('4x10') || sku.includes('040')) {
            sheetW = 48; sheetH = 120;
        } else if (desc.includes('5x10') || sku.includes('5x10')) {
            sheetW = 60; sheetH = 120;
        }

        // Bounding Box Orientations
        const yieldX1 = Math.floor(sheetW / reqW) * Math.floor(sheetH / reqH);
        const yieldX2 = Math.floor(sheetW / reqH) * Math.floor(sheetH / reqW);
        const bestYield = Math.max(yieldX1, yieldX2, 1);

        const sheetsNeeded = Math.ceil(qty / bestYield);
        const totalSqFt = (sheetW * sheetH * sheetsNeeded) / 144;
        const dropSqFt = totalSqFt - ((reqW * reqH * qty) / 144);

        const waste = parseFloat(material.waste_factor) || 1.15;
        const costPerSheet = parseFloat(material.internal_cost);
        const totalCost = sheetsNeeded * costPerSheet * waste;

        return {
            sheetW, sheetH, bestYield, sheetsNeeded, totalSqFt, dropSqFt, totalCost, wasteFactor: waste, costPerSheet
        };
    },

    // 3. STRUCTURAL MEDIA PHYSICS (Linear Feed)
    calculateLinearYield: (reqLF: number, qty: number, material: any, stickFeet: number = 24) => {
        const totalLF = reqLF * qty;
        const sticksNeeded = Math.ceil(totalLF / stickFeet);
        const dropLF = (sticksNeeded * stickFeet) - totalLF;

        const waste = parseFloat(material.waste_factor) || 1.15;
        const costPerLF = parseFloat(material.internal_cost);
        const totalCost = totalLF * costPerLF * waste;

        return {
            totalLF, sticksNeeded, dropLF, totalCost, wasteFactor: waste, costPerLF
        };
    }
};