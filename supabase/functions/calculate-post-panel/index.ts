declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req: any) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const requestData = await req.json();
        const inputs = requestData.inputs || {};
        const config = requestData.config || {};
        const auditMode = requestData.audit_mode || 'retail_only';

        // Physics Constants
        const waste = parseFloat(config.Waste_Factor) || 1.15;
        const risk = parseFloat(config.Factor_Risk) || 1.05;
        const targetMargin = parseFloat(config.Target_Margin_Pct) || 0.60;
        
        // Labor Rates (Fallback if missing in config)
        const rateFab = parseFloat(config.Rate_Shop_Labor) || 20.00;
        const ratePaint = parseFloat(config.Rate_Paint_Labor) || 30.00;
        const rateProd = parseFloat(config.Rate_Operator) || 20.00;

        const ret: any[] = [];
        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };

        // 1. POST MATH
        const postInches = (inputs.thag + inputs.belowGrade) * 2;
        const postLF = postInches / 12;
        const postCostLF = parseFloat(config[inputs.postKey]) || 6.00; // Database mapping
        const totalPostCost = R(`Structural Posts (${inputs.postSize}")`, postLF * postCostLF * waste, `${postInches}" (${postLF.toFixed(1)} LF) * $${postCostLF.toFixed(2)}/LF [[${inputs.postKey}]] * Waste`);

        // 2. FRAME MATH (Flush vs Between constraint)
        let frameInches = 0;
        let cutCount = 2; // Posts always have 2 cuts
        let weldPoints = 0;

        if (inputs.mountStyle === 'Flush') {
            // Horizontal bars bridge the inside of the posts
            frameInches = (inputs.w - (inputs.postSize * 2)) * 2;
            cutCount += 2; 
            weldPoints += 4;
        } else {
            // Full 4-piece box
            frameInches = (inputs.w * 2) + (inputs.h * 2);
            cutCount += 4;
            weldPoints += 8;
        }
        
        const frameLF = frameInches / 12;
        const frameCostLF = parseFloat(config[inputs.frameKey]) || 1.45;
        const totalFrameCost = R(`Internal Frame (${inputs.mountStyle})`, frameLF * frameCostLF * waste, `${frameInches}" (${frameLF.toFixed(1)} LF) * $${frameCostLF.toFixed(2)}/LF [[${inputs.frameKey}]] * Waste`);

        // 3. FACE PANELS
        const sqftPerFace = (inputs.w * inputs.h) / 144;
        const totalSqFt = sqftPerFace * inputs.sides;
        const faceCostSqFt = parseFloat(config[inputs.faceKey]) || 3.07;
        const totalFaceCost = R(`Sign Faces (${inputs.sides} Sided)`, totalSqFt * faceCostSqFt * waste, `${totalSqFt.toFixed(1)} SF * $${faceCostSqFt.toFixed(2)}/sf [[${inputs.faceKey}]] * Waste`);

        // 4. EXPLODED LABOR ROUTING
        // A. Fabrication
        const sawLabor = R(`Fabrication: Saw Cuts`, (cutCount * 0.1) * rateFab, `${cutCount} cuts @ 6 mins * $${rateFab}/hr`);
        const weldLabor = R(`Fabrication: Welding/Assembly`, (weldPoints * 0.05) * rateFab, `${weldPoints} points @ 3 mins * $${rateFab}/hr`);
        
        let paintLabor = 0;
        let graphicLabor = 0;

        // B. Paint & Graphics Logic Gate
        if (inputs.graphicType === 'Paint_Print' || inputs.graphicType === 'Paint_Vinyl') {
            // Paint required
            const paintArea = ((postLF * inputs.postSize * 4) / 12) + totalSqFt; // Posts + Faces
            R(`Paint: Prep & Booth Setup`, 0.5 * ratePaint, `30 mins * $${ratePaint}/hr`);
            paintLabor = R(`Paint: Primer & Finish`, (paintArea * 0.05) * ratePaint, `${paintArea.toFixed(1)} SF @ 3 mins/SF * $${ratePaint}/hr`);
            
            if (inputs.graphicType === 'Paint_Print') {
                // Contour Cut Print
                graphicLabor = R(`Graphics: Print, Cut, Weed & Mount`, (totalSqFt * 0.2) * rateProd, `${totalSqFt.toFixed(1)} SF * 12 mins/SF * $${rateProd}/hr`);
            } else {
                // Contour Cut Vinyl (High Weeding Time)
                graphicLabor = R(`Graphics: Plot, Complex Weed & Mask`, (totalSqFt * 0.4) * rateProd, `${totalSqFt.toFixed(1)} SF * 24 mins/SF * $${rateProd}/hr`);
            }
        } else if (inputs.graphicType === 'NoPaint_Print') {
            // Full coverage print (No Paint)
            graphicLabor = R(`Graphics: Full Coverage Print & Mount`, (totalSqFt * 0.15) * rateProd, `${totalSqFt.toFixed(1)} SF * 9 mins/SF * $${rateProd}/hr`);
        }

        // 5. TOTALS & BIDIRECTIONAL MARGIN
        const rawHardCost = totalPostCost + totalFrameCost + totalFaceCost + sawLabor + weldLabor + paintLabor + graphicLabor;
        const finalCost = rawHardCost * risk;
        
        // Post & Panel Bidirectional Logic
        const unitRetail = finalCost / (1 - targetMargin);

        const payload = {
            retail: {
                unitPrice: unitRetail,
                grandTotal: unitRetail * inputs.qty,
            },
            cost: {
                total: finalCost * inputs.qty,
                breakdown: ret
            },
            metrics: {
                margin: targetMargin
            }
        };

        if (auditMode === 'retail_only') payload.cost.breakdown = [];

        return new Response(JSON.stringify(payload), { headers: corsHeaders, status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 });
    }
});