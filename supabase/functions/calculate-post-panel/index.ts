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

        // Physics Constants & Global Overrides
        const waste = parseFloat(config.Waste_Factor) || 1.15;
        const risk = parseFloat(config.Factor_Risk) || 1.05;
        const targetMargin = parseFloat(config.Target_Margin_Pct) || 0.60;
        
        const rateFab = parseFloat(config.Rate_Shop_Labor) || 20.00;
        const rateProd = parseFloat(config.Rate_Operator) || 25.00;
        const ratePaint = parseFloat(config.Rate_Paint_Labor) || 30.00;
        const rateCnc = parseFloat(config.Rate_CNC_Labor) || 25.00;

        const ret: any[] = [];
        const cst: any[] = [];

        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };
        const L = (category: string, label: string, total: number, formula: string) => { if (total > 0) cst.push({label, total, formula, category}); return total; };

        // 1. POST MATH
        const postInches = (inputs.thag + inputs.belowGrade) * 2;
        const postLF = postInches / 12;
        const postCostLF = parseFloat(config[inputs.postKey]) || 6.00;
        L('METAL_MAT', `Structural Posts (${inputs.postSize}")`, postLF * postCostLF * waste, `${postInches}" (${postLF.toFixed(1)} LF) * $${postCostLF.toFixed(2)}/LF [[${inputs.postKey}]] * Waste`);

        const capCost = parseFloat(config.Cost_Post_Cap) || 5.00;
        L('METAL_MAT', `Post Caps (${inputs.postSize}")`, 2 * capCost, `2 Caps * $${capCost.toFixed(2)}/ea`);

        const holeRadiusFt = ((inputs.postSize * 3) / 2) / 12;
        const footerHeightFt = (inputs.belowGrade * 0.66) / 12;
        const holeVolumeCuFt = Math.PI * Math.pow(holeRadiusFt, 2) * footerHeightFt;
        const bagsNeeded = Math.ceil((holeVolumeCuFt * 2) / 0.6); 
        L('METAL_MAT', `Concrete Tap Footers (80lb)`, bagsNeeded * (parseFloat(config.Cost_Concrete_Bag) || 4.50), `${bagsNeeded} Bags * $4.50/bag`);

        // 2. FRAME MATH (Flush vs Between constraint)
        let frameInches = 0;
        let cutCount = 2; // Posts
        let weldPoints = 0;

        if (inputs.mountStyle === 'Flush') {
            frameInches = (inputs.w - (inputs.postSize * 2)) * 2;
            cutCount += 2; weldPoints += 4;
        } else {
            frameInches = (inputs.w * 2) + (inputs.h * 2);
            cutCount += 4; weldPoints += 8;
        }
        
        const frameLF = frameInches / 12;
        const frameCostLF = parseFloat(config[inputs.frameKey]) || 1.45;
        L('METAL_MAT', `Internal Frame (${inputs.mountStyle})`, frameLF * frameCostLF * waste, `${frameInches}" (${frameLF.toFixed(1)} LF) * $${frameCostLF.toFixed(2)}/LF [[${inputs.frameKey}]] * Waste`);

        // 3. FACE PANELS & ADHESIVE
        const sqftPerFace = (inputs.w * inputs.h) / 144;
        const totalSqFt = sqftPerFace * inputs.sides;
        const faceCostSqFt = parseFloat(config[inputs.faceKey]) || 3.07;
        
        L('METAL_MAT', `Sign Faces (${inputs.sides} Sided)`, totalSqFt * faceCostSqFt * waste, `${totalSqFt.toFixed(1)} SF * $${faceCostSqFt.toFixed(2)}/sf [[${inputs.faceKey}]] * Waste`);
        L('METAL_MAT', `Structural Adhesive`, Math.ceil(frameLF/10) * (parseFloat(config.Cost_Adhesive_Tube) || 18.71), `Cartridges required to bond faces`);

        // 4. METAL LABOR
        L('METAL_LAB', `Gather Materials`, (10 / 60) * rateFab, `10 Mins * $${rateFab}/hr`);
        L('METAL_LAB', `Saw Cuts (Posts & Frame)`, (cutCount * 5 / 60) * rateFab, `${cutCount} cuts @ 5 mins * $${rateFab}/hr`);
        L('METAL_LAB', `Tack Welding`, (weldPoints * 1.5 / 60) * rateFab, `${weldPoints} points @ 1.5 mins * $${rateFab}/hr`);
        L('METAL_LAB', `Weld Grinding & Cleaning`, (weldPoints * 0.33 / 60) * rateFab, `${weldPoints} points @ 0.33 mins * $${rateFab}/hr`);
        L('METAL_LAB', `Adhesive Application`, (inputs.sides * 7 / 60) * rateFab, `${inputs.sides} Sides @ 7 mins * $${rateFab}/hr`);
        
        // Router vs Shear
        if (inputs.faceKey.includes('ACM')) {
            L('METAL_LAB', `CNC Router Setup & Run`, (10/60 * rateCnc) + ((totalSqFt * 1 / 60) * rateCnc), `10 Min Setup + (1 Min/SF Run) * $${rateCnc}/hr`);
        } else {
            L('METAL_LAB', `Shear Setup & Run`, ((5 + (4 * 1)) / 60) * rateFab, `5 Min Setup + (4 Cuts * 1 Min) * $${rateFab}/hr`);
        }

        // 5. PAINT LOGIC
        const postArea = ((postLF * inputs.postSize * 4) / 12);
        const paintArea = (inputs.graphicType === 'NoPaint_Print') ? postArea : postArea + totalSqFt;

        L('PAINT_MAT', `Automotive Polyurethane Paint`, paintArea * (parseFloat(config.Cost_Paint_SqFt) || 2.50) * waste, `${paintArea.toFixed(1)} SF * $2.50/SF * Waste`);
        L('PAINT_LAB', `Paint Booth Setup & Clean`, (20 / 60) * ratePaint, `20 Mins * $${ratePaint}/hr`);
        L('PAINT_LAB', `Sanding & Prep`, (paintArea * 0.25 / 60) * ratePaint, `${paintArea.toFixed(1)} SF * 0.25 Mins/SF * $${ratePaint}/hr`);
        L('PAINT_LAB', `Primer Coat`, (paintArea * 0.10 / 60) * ratePaint, `${paintArea.toFixed(1)} SF * 0.10 Mins/SF * $${ratePaint}/hr`);
        L('PAINT_LAB', `Finish Coat`, (paintArea * 0.31 / 60) * ratePaint, `${paintArea.toFixed(1)} SF * 0.31 Mins/SF * $${ratePaint}/hr`);

        // 6. GRAPHICS LOGIC
        L('VINYL_LAB', `Job Setup (File RIP)`, (15 / 60) * rateProd, `15 Mins * $${rateProd}/hr`);

        if (inputs.graphicType === 'Paint_Print') {
            L('VINYL_MAT', `Cast Vinyl Media`, totalSqFt * (parseFloat(config.Cost_Vin_Cast)||1.30) * waste, `${totalSqFt.toFixed(1)} SF * $1.30/SF * Waste`);
            L('VINYL_MAT', `Latex Ink`, totalSqFt * (parseFloat(config.Cost_Ink_Latex)||0.16) * waste, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste`);
            L('VINYL_MAT', `Transfer Tape (Masking)`, totalSqFt * (parseFloat(config.Cost_Transfer_Tape)||0.15) * waste, `${totalSqFt.toFixed(1)} SF * Mask * Waste`);
            
            L('VINYL_LAB', `Print Machine Run`, (totalSqFt / 150) * (parseFloat(config.Rate_Machine_Print)||5), `150 SF/Hr Speed * $5/hr`);
            L('VINYL_LAB', `Plotter/Cutter Run`, (totalSqFt / 50) * (parseFloat(config.Rate_Machine_Cut)||5), `50 SF/Hr Speed * $5/hr`);
            L('VINYL_LAB', `Weeding Labor (Standard)`, (totalSqFt * 2 / 60) * rateFab, `${totalSqFt.toFixed(1)} SF * 2 Mins/SF * $${rateFab}/hr`);
            L('VINYL_LAB', `Masking Labor`, (totalSqFt * 1 / 60) * rateFab, `${totalSqFt.toFixed(1)} SF * 1 Mins/SF * $${rateFab}/hr`);
        } 
        else if (inputs.graphicType === 'Paint_Vinyl') {
            L('VINYL_MAT', `Colored Cast Vinyl Media`, totalSqFt * (parseFloat(config.Cost_Vin_Cast)||1.30) * waste, `${totalSqFt.toFixed(1)} SF * $1.30/SF * Waste`);
            L('VINYL_MAT', `Transfer Tape (Masking)`, totalSqFt * (parseFloat(config.Cost_Transfer_Tape)||0.15) * waste, `${totalSqFt.toFixed(1)} SF * Mask * Waste`);
            
            L('VINYL_LAB', `Plotter/Cutter Run`, (totalSqFt / 50) * (parseFloat(config.Rate_Machine_Cut)||5), `50 SF/Hr Speed * $5/hr`);
            L('VINYL_LAB', `Weeding Labor (Complex)`, (totalSqFt * 8 / 60) * rateFab, `${totalSqFt.toFixed(1)} SF * 8 Mins/SF * $${rateFab}/hr`);
            L('VINYL_LAB', `Masking Labor`, (totalSqFt * 1 / 60) * rateFab, `${totalSqFt.toFixed(1)} SF * 1 Mins/SF * $${rateFab}/hr`);
        } 
        else if (inputs.graphicType === 'NoPaint_Print') {
            L('VINYL_MAT', `Cast Vinyl Media`, totalSqFt * (parseFloat(config.Cost_Vin_Cast)||1.30) * waste, `${totalSqFt.toFixed(1)} SF * $1.30/SF * Waste`);
            L('VINYL_MAT', `Latex Ink`, totalSqFt * (parseFloat(config.Cost_Ink_Latex)||0.16) * waste, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste`);
            L('VINYL_MAT', `Overlaminate Media`, totalSqFt * (parseFloat(config.Cost_Lam_Cast)||0.96) * waste, `${totalSqFt.toFixed(1)} SF * $0.96/SF * Waste`);
            
            L('VINYL_LAB', `Print Machine Run`, (totalSqFt / 150) * (parseFloat(config.Rate_Machine_Print)||5), `150 SF/Hr Speed * $5/hr`);
            L('VINYL_LAB', `Lamination Machine Run`, (totalSqFt / 300) * rateFab, `300 SF/Hr Speed * $${rateFab}/hr`);
            L('VINYL_LAB', `Vinyl Mount Labor`, (totalSqFt * 0.25 / 60) * rateFab, `${totalSqFt.toFixed(1)} SF * 0.25 Mins/SF * $${rateFab}/hr`);
        }

        // 7. TOTALS & BIDIRECTIONAL MARGIN
        const rawHardCost = cst.reduce((s,i) => s + i.total, 0);
        const finalCost = rawHardCost * risk;
        const unitRetail = finalCost / (1 - targetMargin);

        const payload = {
            retail: { unitPrice: unitRetail, grandTotal: unitRetail * inputs.qty },
            cost: { total: finalCost * inputs.qty, breakdown: cst },
            metrics: { margin: targetMargin }
        };

        if (auditMode === 'retail_only') payload.cost.breakdown = [];

        return new Response(JSON.stringify(payload), { headers: corsHeaders, status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 });
    }
});