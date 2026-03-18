declare const Deno: any;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// ============================================================================
// 1. UNIVERSAL SHARED AGENTS (The Specialists)
// These handle the financial math universally for ANY product.
// ============================================================================

const Agent_Cost_Valuator = {
    evaluate: (bomItems: any[], config: any, qty: number) => {
        const cst: any[] = [];
        let totalHardCostRaw = 0;
        const riskFactor = parseFloat(config.Factor_Risk || "1.10");

        bomItems.forEach(item => {
            const total = item.unitQty * item.unitRate * (item.wasteMult || 1) * qty;
            if (total > 0) {
                cst.push({ label: item.label, total: total, formula: item.formula, cB: item.category, meta: item.meta || {} });
                totalHardCostRaw += total;
            }
        });

        return {
            total: totalHardCostRaw * riskFactor,
            breakdown: cst
        };
    }
};

const Agent_Retail_Markup = {
    evaluate: (hardCostTotal: number, config: any, qty: number) => {
        const ret: any[] = [];
        const targetMargin = parseFloat(config.Target_Margin_Pct || "0.60");
        const overrideSales = parseFloat(config.Override_Retail_Total || "0");
        const minOrder = parseFloat(config.Retail_Min_Order || "150") * qty;

        let grandTotalRaw = overrideSales > 0 ? overrideSales : (hardCostTotal / (1 - targetMargin));
        let grandTotal = Math.max(grandTotalRaw, minOrder);
        let isMinApplied = grandTotalRaw < minOrder;

        ret.push({ label: `Market Value (${(targetMargin*100).toFixed(1)}% Profit Margin)`, total: grandTotalRaw, formula: `Total Hard Cost / (1 - 0.${(targetMargin*100).toFixed(0)})` });
        if (isMinApplied) ret.push({ label: 'Shop Minimum Surcharge', total: minOrder - grandTotalRaw, formula: 'Minimum order difference' });

        return { unitPrice: grandTotal / qty, grandTotal, breakdown: ret, isMinApplied, targetMargin };
    }
};

// ============================================================================
// 2. PRODUCT-SPECIFIC BUILDER (The Foreman)
// Simulates the physical Post & Panel and passes the data baton.
// ============================================================================

Deno.serve(async (req: any) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    
    try {
        const requestData = await req.json();
        const inputs = requestData.inputs || {};
        const config = requestData.config || {};
        const qty = parseInt(inputs.qty) || 1;

        const num = (k: string, fallback: number) => { const p = parseFloat(config[k]); return isNaN(p) ? fallback : p; };
        const V = (k: string) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}">[${k}]</span>`;

        // --- STEP A: STRUCTURAL SIMULATION ---
        const thag = parseFloat(inputs.thag) || 60;
        const belowGrade = parseFloat(inputs.belowGrade) || 36;
        const topOffset = parseFloat(inputs.topOffset) || 0;
        const postSize = parseFloat(inputs.postSize) || 2;
        const fThickMatch = (inputs.frameMat || '').match(/(\d+(\.\d+)?)/);
        const fThick = fThickMatch ? parseFloat(fThickMatch) : 2;
        const panels = inputs.panels || [];

        let totalPanelH = 0;
        let maxOverallW = 0;
        let basePostSpacing = 0;
        let frameCutDesc: string[] = [];
        let bom: any[] = []; // Bill of Materials
        
        const wastePct = num('Waste_Factor', 1.15);
        const rateShop = num('Rate_Shop_Labor', 20);

        // Posts
        const postLF = ((thag + belowGrade) * 2) / 12;
        const postKey = `Cost_Post_${inputs.postType}_${postSize}`;
        const costPost = num(postKey, postSize * 3);
        bom.push({ label: `Structural Posts (${inputs.postType} ${postSize}")`, unitQty: postLF, unitRate: costPost, wasteMult: wastePct, category: 'struct_mat', formula: `${postLF.toFixed(1)} LF * $${costPost.toFixed(2)}/LF [${V(postKey)}] * Waste` });

        if (inputs.hasConcrete) {
            bom.push({ label: `Concrete Footings`, unitQty: 2, unitRate: num('Cost_Concrete_Bag', 6.00), wasteMult: 1, category: 'concrete', formula: `2 Bags * $${num('Cost_Concrete_Bag', 6.00).toFixed(2)}/ea` });
        }

        // Panels & Framework
        let totalFaceArea = 0;
        panels.forEach((p: any, idx: number) => {
            let pW = parseFloat(p.w) || 24;
            let pH = parseFloat(p.h) || 24;
            let sides = parseInt(p.sides) || 1;
            totalFaceArea += ((pW * pH) / 144) * sides;
            totalPanelH += pH + (idx === 0 ? 0 : (parseFloat(p.gap) || 0));

            let isFlush = p.mountStyle === 'Flush';
            let pOverallW = isFlush ? pW : pW + (postSize * 2);
            if (pOverallW > maxOverallW) maxOverallW = pOverallW;
            if (idx === 0) basePostSpacing = isFlush ? pW - (postSize * 2) : pW;

            let pLF = isFlush ? (basePostSpacing * 2) / 12 : ((pW * 2) + ((pH - fThick * 2) * 2)) / 12;
            let cuts = isFlush ? 2 : 4;
            
            let frameKey = `Cost_Frame_${inputs.frameMat}`;
            bom.push({ label: `Internal Frame P${idx+1}`, unitQty: pLF * (sides === 2 && isFlush ? 2 : 1), unitRate: num(frameKey, 1.45), wasteMult: wastePct, category: 'struct_mat', formula: `${pLF.toFixed(1)} LF * $${num(frameKey, 1.45).toFixed(2)}/LF [${V(frameKey)}] * Waste` });
            
            frameCutDesc.push(`Panel ${idx+1}: (x${cuts}) ${isFlush ? basePostSpacing : pW}" cuts`);
        });

        // Face Material
        let faceCost = num('Cost_Stock_063_4x8', 98.12) / 32;
        bom.push({ label: `Sign Faces (.063 Alum)`, unitQty: totalFaceArea, unitRate: faceCost, wasteMult: wastePct, category: 'faces', formula: `${totalFaceArea.toFixed(1)} SF * $${faceCost.toFixed(2)}/sf * Waste` });
        
        // Labor
        bom.push({ label: `Fabrication Labor`, unitQty: (30 / 60), unitRate: rateShop, wasteMult: 1, category: 'struct_lab', formula: `30 Mins * $${rateShop}/hr` });

        // --- STEP B: THE DATA BATON HANDOFF ---
        
        // 1. Send BOM to Valuator
        const costResult = Agent_Cost_Valuator.evaluate(bom, config, qty);

        // 2. Send Hard Cost to Retail Markup
        const retailResult = Agent_Retail_Markup.evaluate(costResult.total, config, qty);

        // 3. Compile the Spatial Manifest for the Visualizer
        const clearance = thag - totalPanelH - topOffset;
        const geom = {
            overallW: maxOverallW,
            above: thag,
            under: belowGrade,
            clearance: clearance,
            totalPanelH: totalPanelH,
            postSpacing: basePostSpacing,
            post: postSize,
            frameThick: fThick,
            topOffset: topOffset,
            panels: panels,
            cutList: frameCutDesc // THIS FIXES THE CRASH!
        };

        // --- STEP C: RETURN STANDARD CONTRACT ---
        const payload = { 
            retail: retailResult, 
            cost: costResult, 
            metrics: { margin: retailResult.targetMargin },
            geom: geom 
        };

        return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) { 
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders }); 
    }
});