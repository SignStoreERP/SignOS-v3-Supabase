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
        const auditMode = requestData.audit_mode || 'full'; // Forced to Full to allow BOM extraction

        // Physics Constants & Global Overrides
        const waste = parseFloat(config.Waste_Factor) || 1.15;
        const risk = parseFloat(config.Factor_Risk) || 1.05;
        const targetMargin = parseFloat(config.Target_Margin_Pct) || 0.60;
        
        // Labor Rates (Forcing Shop rate for paint as per audit request)
        const rateShop = parseFloat(config.Rate_Shop_Labor) || 150.00;

        const ret: any[] = [];
        const cst: any[] = [];

        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };
        const L = (category: string, label: string, total: number, formula: string) => { cst.push({label, total, formula, category}); return total; };

        // 1. POST MATH
        const postInchesPer = inputs.thag + inputs.belowGrade;
        const postLFPer = Math.ceil(postInchesPer / 12);
        const totalPostLF = postLFPer * 2 * inputs.qty;
        
        const postCostLF = parseFloat(config[inputs.postKey]) || 6.00;
        const postMetalName = inputs.postKey.includes('Aluminum') ? 'Aluminum' : 'Steel';
        
        L('METAL_MAT', `Structural Posts (${inputs.postSize}")`, totalPostLF * postCostLF * waste, `${postInchesPer}" (${postLFPer} LF/Ea) * 2 Posts * $${postCostLF.toFixed(2)}/LF [[${inputs.postKey}]] * Waste`);

        const capCount = inputs.mountStyle === 'Flush' ? 0 : (2 * inputs.qty);
        if (capCount > 0) {
            const capCost = parseFloat(config.Cost_Post_Cap) || 5.00;
            L('METAL_MAT', `Post Caps (${inputs.postSize}")`, capCount * capCost, `${capCount} Caps * $${capCost.toFixed(2)}/ea`);
        }

        // Concrete Metrics (Cost explicitly untracked in ledger, but yield retained for info)
        const holeRadiusFt = ((inputs.postSize * 3) / 2) / 12;
        const footerHeightFt = (inputs.belowGrade * 0.66) / 12;
        const holeVolumeCuFt = Math.PI * Math.pow(holeRadiusFt, 2) * footerHeightFt;
        const bagsNeeded = Math.ceil((holeVolumeCuFt * 2) / 0.6) * inputs.qty;
        L('METAL_MAT', `${bagsNeeded} Bags (80lb) Concrete`, 0, `Yield only - Cost excluded from job ledger.`);

        // 2. FRAME MATH
        let frameLF = 0;
        let cutCount = 2; // 2 cuts for the posts
        let weldPoints = 0;

        if (inputs.mountStyle === 'Flush') {
            const hBarInches = inputs.w - (inputs.postSize * 2);
            frameLF = Math.ceil(hBarInches / 12) * 2; // Round up each piece
            cutCount += 2; 
            weldPoints = 8; // 4 points * 2 tacks each
        } else {
            frameLF = (Math.ceil(inputs.w / 12) * 2) + (Math.ceil(inputs.h / 12) * 2);
            cutCount += 4; 
            weldPoints = 16; // 8 points * 2 tacks each
        }
        const totalFrameLF = frameLF * inputs.qty;
        const frameCostLF = parseFloat(config[inputs.frameKey]) || 1.45;
        L('METAL_MAT', `Internal Frame (${inputs.mountStyle})`, totalFrameLF * frameCostLF * waste, `Calculated LF rounded up per piece (${totalFrameLF} LF total) * $${frameCostLF.toFixed(2)}/LF [[${inputs.frameKey}]] * Waste`);

        // 3. FACE PANELS & ADHESIVE
        const sqftPerFace = (inputs.w * inputs.h) / 144;
        const totalSqFt = sqftPerFace * inputs.sides * inputs.qty;
        const sheetCost = parseFloat(config[inputs.faceKey]) || 98.12; 
        const faceCostSqFt = sheetCost / 32; // Derive sqft cost from standard 4x8 sheet
        L('METAL_MAT', `Sign Faces (${inputs.sides} Sided)`, totalSqFt * faceCostSqFt * waste, `${totalSqFt.toFixed(1)} SF * $${faceCostSqFt.toFixed(2)}/sf [[${inputs.faceKey}]] * Waste`);

        const perimeterInches = (inputs.w * 2 + inputs.h * 2) * inputs.sides * inputs.qty;
        const perimeterLF = perimeterInches / 12;
        const cartridges = Math.ceil(perimeterLF / 10); // 10 LF yield for 0.25" bead
        L('METAL_MAT', `Structural Adhesive`, cartridges * (parseFloat(config.Cost_Adhesive_Tube) || 18.71), `${perimeterLF.toFixed(1)} LF (0.25" bead) / 10 LF per tube`);

        // 4. METAL LABOR
        L('METAL_LAB', `Gather Materials`, (10 / 60) * rateShop, `10 Mins * $${rateShop}/hr`);
        
        const totalCuts = cutCount * inputs.qty;
        L('METAL_LAB', `Saw Cuts (Posts & Frame)`, (totalCuts * 2 / 60) * rateShop, `${totalCuts} cuts @ 2 mins * $${rateShop}/hr`);
        
        const totalWelds = weldPoints * inputs.qty;
        L('METAL_LAB', `Tack Welding`, (totalWelds * 0.5 / 60) * rateShop, `${totalWelds} welds @ 0.5 mins * $${rateShop}/hr`);
        L('METAL_LAB', `Weld Grinding & Cleaning`, (totalWelds * 0.33 / 60) * rateShop, `${totalWelds} welds @ 0.33 mins * $${rateShop}/hr`);
        
        L('METAL_LAB', `Adhesive Application`, (perimeterLF * 1 / 60) * rateShop, `${perimeterLF.toFixed(1)} LF @ 1 min/LF * $${rateShop}/hr`);

        if (inputs.faceKey.includes('ACM')) {
            L('METAL_LAB', `CNC Router Setup & Run`, (10/60 * rateShop) + ((totalSqFt * 1 / 60) * rateShop), `10 Min Setup + (1 Min/SF Run) * $${rateShop}/hr`);
        } else {
            L('METAL_LAB', `Shear Setup & Run`, ((5 + ((4 * inputs.sides * inputs.qty) * 1)) / 60) * rateShop, `5 Min Setup + (4 Cuts * 1 Min) * $${rateShop}/hr`);
        }

        // Metal Stage 1 Sanding Prep
        const postArea = ((totalPostLF * inputs.postSize * 4) / 12);
        const paintArea = (inputs.graphicType === 'NoPaint_Print') ? postArea : postArea + totalSqFt;
        L('METAL_LAB', `Stage 1 Sanding & Prep (Metal Fab)`, (paintArea * 0.25 / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.25 Mins/SF * $${rateShop}/hr`);

        // 5. PAINT LOGIC
        const paintCostSqFt = parseFloat(config.Cost_Paint_SqFt) || 2.50;
        
        L('PAINT_MAT', `Automotive Primer`, (paintArea * (paintCostSqFt * 0.4) * waste) + 1.00, `${paintArea.toFixed(1)} SF * $${(paintCostSqFt * 0.4).toFixed(2)}/SF * Waste + $1.00 Cup`);
        L('PAINT_MAT', `Automotive Paint (Color)`, (paintArea * (paintCostSqFt * 0.6) * waste) + 1.00, `${paintArea.toFixed(1)} SF * $${(paintCostSqFt * 0.6).toFixed(2)}/SF * Waste + $1.00 Cup`);

        L('PAINT_LAB', `Prep and Move Sign`, (20 / 60) * rateShop, `20 Mins * $${rateShop}/hr`);
        L('PAINT_LAB', `Sanding & Prep`, (paintArea * 0.25 / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.25 Mins/SF * $${rateShop}/hr`);
        L('PAINT_LAB', `Primer Coat`, (paintArea * 0.10 / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.10 Mins/SF * $${rateShop}/hr`);
        L('PAINT_LAB', `Finish Coat`, (paintArea * 0.31 / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.31 Mins/SF * $${rateShop}/hr`);

        // 6. GRAPHICS LOGIC
        L('VINYL_LAB', `Job Setup (File RIP)`, (5 / 60) * rateShop, `5 Mins * $${rateShop}/hr`);

        const isPrint = inputs.graphicType.includes('Print');
        const mediaName = isPrint ? '3M IJ180 Cast Wrap' : 'Oracal 751 High Perf';

        L('VINYL_MAT', `Cast Vinyl Media (${mediaName})`, totalSqFt * (parseFloat(config.Cost_Vin_Cast)||1.30) * waste, `${totalSqFt.toFixed(1)} SF * $1.30/SF * Waste`);
        
        if (isPrint) {
            L('VINYL_MAT', `Latex Ink`, totalSqFt * (parseFloat(config.Cost_Ink_Latex)||0.16) * waste, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste`);
            L('VINYL_MAT', `Overlaminate Media (3M 8518)`, totalSqFt * (parseFloat(config.Cost_Lam_Cast)||0.96) * waste, `${totalSqFt.toFixed(1)} SF * $0.96/SF * Waste`);
            
            L('VINYL_LAB', `Print Machine Run`, (totalSqFt / 150) * (parseFloat(config.Rate_Machine_Print)||5), `150 SF/Hr Speed * $5/hr`);
            L('VINYL_LAB', `Lamination Machine Run`, (totalSqFt / 300) * rateShop, `300 SF/Hr Speed * $${rateShop}/hr`);
        }
        
        L('VINYL_MAT', `Transfer Tape (Masking)`, totalSqFt * (parseFloat(config.Cost_Transfer_Tape)||0.15) * waste, `${totalSqFt.toFixed(1)} SF * $0.15/SF * Waste`);

        if (isPrint || inputs.graphicType === 'Paint_Vinyl') {
            L('VINYL_LAB', `Plotter/Cutter Run`, (totalSqFt / 50) * (parseFloat(config.Rate_Machine_Cut)||5), `50 SF/Hr Speed * $5/hr`);
        }

        const weedMins = inputs.graphicType === 'Paint_Vinyl' ? 8 : 0.5;
        L('VINYL_LAB', `Weeding Labor`, (totalSqFt * weedMins / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * ${weedMins} Mins/SF * $${rateShop}/hr`);
        L('VINYL_LAB', `Masking Labor`, (totalSqFt * 0.25 / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 0.25 Mins/SF * $${rateShop}/hr`);
        L('VINYL_LAB', `Graphics Installation (Shop)`, (totalSqFt * 0.333 / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 20 Sec/SF * $${rateShop}/hr`);

        // 7. TOTALS & BIDIRECTIONAL MARGIN
        const rawHardCost = cst.reduce((s,i) => s + i.total, 0);
        const finalCost = rawHardCost * risk;
        const unitRetail = finalCost / (1 - targetMargin);

        const payload = {
            retail: { unitPrice: unitRetail, grandTotal: unitRetail * inputs.qty },
            cost: { total: finalCost, breakdown: cst }, // Ensure we pass the clean total cost
            metrics: { margin: targetMargin }
        };

        if (auditMode === 'retail_only') payload.cost.breakdown = [];

        return new Response(JSON.stringify(payload), { headers: corsHeaders, status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 });
    }
});