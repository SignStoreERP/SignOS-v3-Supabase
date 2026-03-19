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
        const wasteDisplay = ((waste - 1) * 100).toFixed(0) + '%';
        
        const risk = parseFloat(config.Factor_Risk) || 1.05;
        const targetMargin = parseFloat(config.Target_Margin_Pct) || 0.60;
        
        const rateShop = parseFloat(config.Rate_Shop_Labor) || 150.00;
        const rateCnc = parseFloat(config.Rate_CNC_Labor) || 150.00;

        const ret: any[] = [];
        const cst: any[] = [];
        
        // Decoupled Bill of Materials Array
        const bomMap: Record<string, string[]> = {};
        const addBOM = (dept: string, amount: string, item: string) => {
            if (!bomMap[dept]) bomMap[dept] = [];
            bomMap[dept].push(`${amount} | ${item}`);
        };

        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };
        const L = (category: string, label: string, total: number, formula: string) => { cst.push({label, total, formula, category}); return total; };

        // 1. POST MATH
        const postInchesPer = inputs.thag + inputs.belowGrade;
        const postLFPer = Math.ceil(postInchesPer / 12);
        const totalPostLF = postLFPer * 2 * inputs.qty;
        
        // Physical Stock Calculation
        const postMetalName = inputs.postMetalName || 'Aluminum';
        const postStickLength = postMetalName === 'Aluminum' ? 24 : 20;
        const postSticksNeeded = Math.ceil(totalPostLF / postStickLength);
        
        addBOM('Metal Fabrication', `${totalPostLF} LF (Pull ${postSticksNeeded}x ${postStickLength}' Sticks)`, `Structural Posts (${inputs.postSize}" ${postMetalName})`);

        const postCostLF = parseFloat(config[inputs.postKey]) || 6.00;
        L('METAL_MAT', `Structural Posts (${inputs.postSize}")`, totalPostLF * postCostLF * waste, `${postInchesPer}" (${postLFPer} LF/Ea) * 2 Posts * $${postCostLF.toFixed(2)}/LF [[${inputs.postKey}]] * ${wasteDisplay} Waste`);

        const capCount = inputs.mountStyle === 'Flush' ? 0 : (2 * inputs.qty);
        if (capCount > 0) {
            const capCost = parseFloat(config.Cost_Post_Cap) || 5.00;
            L('METAL_MAT', `Post Caps (${inputs.postSize}")`, capCount * capCost, `${capCount} Caps * $${capCost.toFixed(2)}/ea`);
            addBOM('Metal Fabrication', `${capCount} Units`, `Post Caps (${inputs.postSize}")`);
        }

        // Concrete Metrics (Separated to Install Hardware)
        const holeRadiusFt = ((inputs.postSize * 3) / 2) / 12;
        const footerHeightFt = (inputs.belowGrade * 0.66) / 12;
        const holeVolumeCuFt = Math.PI * Math.pow(holeRadiusFt, 2) * footerHeightFt;
        const bagsNeeded = Math.ceil((holeVolumeCuFt * 2) / 0.6) * inputs.qty;
        
        L('INSTALL_HDW', `Concrete Tap Footers (80lb)`, bagsNeeded * (parseFloat(config.Cost_Concrete_Bag) || 4.50), `${bagsNeeded} Bags * $4.50/bag`);
        addBOM('Installation Hardware', `${bagsNeeded} Bags`, `Concrete (80lb)`);

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
        const frameMetalName = inputs.frameKey.includes('Alum') ? 'Aluminum' : 'Steel';
        const frameStickLength = frameMetalName === 'Aluminum' ? 24 : 20;
        const frameSticksNeeded = Math.ceil(totalFrameLF / frameStickLength);
        
        addBOM('Metal Fabrication', `${totalFrameLF} LF (Pull ${frameSticksNeeded}x ${frameStickLength}' Sticks)`, `Internal Frame Skeleton`);

        const frameCostLF = parseFloat(config[inputs.frameKey]) || 1.45;
        L('METAL_MAT', `Internal Frame (${inputs.mountStyle})`, totalFrameLF * frameCostLF * waste, `Calculated LF rounded up per piece (${totalFrameLF} LF total) * $${frameCostLF.toFixed(2)}/LF [[${inputs.frameKey}]] * ${wasteDisplay} Waste`);

        // 3. FACE PANELS & ADHESIVE
        const sqftPerFace = (inputs.w * inputs.h) / 144;
        const totalSqFt = sqftPerFace * inputs.sides * inputs.qty;
        
        const facesNeeded = Math.ceil(totalSqFt / 32);
        addBOM('Metal Fabrication', `${totalSqFt.toFixed(1)} SF (Pull ${facesNeeded}x 4x8 Sheets)`, `Sign Faces (${inputs.sides} Sided)`);

        const sheetCost = parseFloat(config[inputs.faceKey]) || 98.12; 
        const faceCostSqFt = sheetCost / 32; 
        L('METAL_MAT', `Sign Faces (${inputs.sides} Sided)`, totalSqFt * faceCostSqFt * waste, `${totalSqFt.toFixed(1)} SF * $${faceCostSqFt.toFixed(2)}/sf [[${inputs.faceKey}]] * ${wasteDisplay} Waste`);

        const perimeterInches = (inputs.w * 2 + inputs.h * 2) * inputs.sides * inputs.qty;
        const perimeterLF = perimeterInches / 12;
        const cartridges = Math.ceil(perimeterLF / 10); // 10 LF yield for 0.25" bead
        
        L('METAL_MAT', `Structural Adhesive`, cartridges * (parseFloat(config.Cost_Adhesive_Tube) || 18.71), `${perimeterLF.toFixed(1)} LF (0.25" bead) / 10 LF per tube`);
        addBOM('Metal Fabrication', `${cartridges} Cartridges`, `Lord's Adhesive (0.25" bead)`);

        // 4. METAL LABOR
        L('METAL_LAB', `Gather Materials`, (10 / 60) * rateShop, `10 Mins * $${rateShop}/hr`);
        
        const totalCuts = cutCount * inputs.qty;
        L('METAL_LAB', `Saw Cuts (Posts & Frame)`, (totalCuts * 2 / 60) * rateShop, `${totalCuts} cuts @ 2 mins * $${rateShop}/hr`);
        
        const totalWelds = weldPoints * inputs.qty;
        L('METAL_LAB', `Tack Welding`, (totalWelds * 0.5 / 60) * rateShop, `${totalWelds} welds @ 0.5 mins * $${rateShop}/hr`);
        L('METAL_LAB', `Weld Grinding & Cleaning`, (totalWelds * 0.33 / 60) * rateShop, `${totalWelds} welds @ 0.33 mins * $${rateShop}/hr`);
        
        L('METAL_LAB', `Adhesive Application`, (perimeterLF * 1 / 60) * rateShop, `${perimeterLF.toFixed(1)} LF @ 1 min/LF * $${rateShop}/hr`);

        if (inputs.faceKey.includes('ACM')) {
            L('METAL_LAB', `CNC Router Setup & Run`, (10/60 * rateCnc) + ((totalSqFt * 1 / 60) * rateCnc), `10 Min Setup + (1 Min/SF Run) * $${rateCnc}/hr`);
        } else {
            L('METAL_LAB', `Shear Setup & Run`, ((5 + ((4 * inputs.sides * inputs.qty) * 1)) / 60) * rateShop, `5 Min Setup + (4 Cuts * 1 Min) * $${rateShop}/hr`);
        }

        // Metal Stage 1 Sanding Prep
        const postArea = ((totalPostLF * inputs.postSize * 4) / 12);
        const paintArea = (inputs.graphicType === 'NoPaint_Print') ? postArea : postArea + totalSqFt;

        // 5. PAINT LOGIC
        if (inputs.graphicType === 'Paint_Print' || inputs.graphicType === 'Paint_Vinyl') {
            const paintCostSqFt = parseFloat(config.Cost_Paint_SqFt) || 2.50;
            
            L('PAINT_MAT', `Automotive Primer`, (paintArea * (paintCostSqFt * 0.4) * waste) + 1.00, `${paintArea.toFixed(1)} SF * $${(paintCostSqFt * 0.4).toFixed(2)}/SF * ${wasteDisplay} Waste + $1.00 Cup`);
            L('PAINT_MAT', `Automotive Paint (Color)`, (paintArea * (paintCostSqFt * 0.6) * waste) + 1.00, `${paintArea.toFixed(1)} SF * $${(paintCostSqFt * 0.6).toFixed(2)}/SF * ${wasteDisplay} Waste + $1.00 Cup`);
            
            addBOM('Paint & Finishes', `${paintArea.toFixed(1)} SF`, `Automotive Paint/Primer Coverage`);

            L('PAINT_LAB', `Paint Mix & Setup`, (4 / 60) * rateShop, `4 Mins Flat * $${rateShop}/hr`);
            L('PAINT_LAB', `Sign Prep (Metal Fab Hand-off)`, (paintArea * 0.15 / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.15 Mins/SF * $${rateShop}/hr`);
            L('PAINT_LAB', `Primer Coat`, (paintArea * 0.10 / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.10 Mins/SF * $${rateShop}/hr`);
            L('PAINT_LAB', `Finish Coat (Color)`, (paintArea * 0.30 / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.30 Mins/SF * $${rateShop}/hr`);
        }

        // 6. GRAPHICS LOGIC
        L('VINYL_LAB', `Job Setup (File RIP)`, (5 / 60) * rateShop, `5 Mins * $${rateShop}/hr`);

        const isPrint = inputs.graphicType.includes('Print');
        const mediaName = isPrint ? '3M IJ180 Cast Wrap' : 'Oracal 751 High Perf';

        L('VINYL_MAT', `Cast Vinyl Media (${mediaName})`, totalSqFt * (parseFloat(config.Cost_Vin_Cast)||1.30) * waste, `${totalSqFt.toFixed(1)} SF * $1.30/SF * ${wasteDisplay} Waste`);
        addBOM('Vinyl & Graphics', `${totalSqFt.toFixed(1)} SF`, `Vinyl Media (${mediaName})`);
        
        if (isPrint) {
            L('VINYL_MAT', `Latex Ink`, totalSqFt * (parseFloat(config.Cost_Ink_Latex)||0.16) * waste, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${wasteDisplay} Waste`);
            L('VINYL_MAT', `Overlaminate Media (3M 8518)`, totalSqFt * (parseFloat(config.Cost_Lam_Cast)||0.96) * waste, `${totalSqFt.toFixed(1)} SF * $0.96/SF * ${wasteDisplay} Waste`);
            addBOM('Vinyl & Graphics', `${totalSqFt.toFixed(1)} SF`, `Overlaminate (3M 8518 Cast)`);
            
            L('VINYL_LAB', `Print Machine Run`, (totalSqFt / 150) * (parseFloat(config.Rate_Machine_Print)||5), `150 SF/Hr Speed * $5/hr`);
            L('VINYL_LAB', `Lamination Machine Run`, (totalSqFt / 300) * rateShop, `300 SF/Hr Speed * $${rateShop}/hr`);
        }
        
        const maskLF = totalSqFt / 4; // 48" wide mask = 4ft
        L('VINYL_MAT', `Transfer Tape (Masking)`, totalSqFt * (parseFloat(config.Cost_Transfer_Tape)||0.15) * waste, `${totalSqFt.toFixed(1)} SF * $0.15/SF * ${wasteDisplay} Waste`);
        addBOM('Vinyl & Graphics', `${maskLF.toFixed(1)} LF`, `Transfer Tape Mask (48" W)`);

        if (isPrint || inputs.graphicType === 'Paint_Vinyl') {
            L('VINYL_LAB', `Plotter/Cutter Run`, (totalSqFt / 50) * (parseFloat(config.Rate_Machine_Cut)||5), `50 SF/Hr Speed * $5/hr`);
        }

        const weedMinsPerSF = inputs.weedingLevel === 'Complex' ? 0.50 : 0.25;
        L('VINYL_LAB', `Weeding Labor`, (totalSqFt * weedMinsPerSF / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * ${weedMinsPerSF} Mins/SF * $${rateShop}/hr`);
        
        const maskMins = maskLF * (5 / 60); // 5 secs per LF
        L('VINYL_LAB', `Masking Labor`, (maskMins / 60) * rateShop, `${maskLF.toFixed(1)} LF (@48" W) * 5 Sec/LF * $${rateShop}/hr`);
        
        L('VINYL_LAB', `Graphics Installation (Shop)`, (totalSqFt * 0.333 / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 20 Sec/SF * $${rateShop}/hr`);

        // 7. TOTALS & BIDIRECTIONAL MARGIN
        const rawHardCost = cst.reduce((s,i) => s + i.total, 0);
        const finalCost = rawHardCost * risk;
        const unitRetail = finalCost / (1 - targetMargin);

        const payload = {
            retail: { unitPrice: unitRetail, grandTotal: unitRetail * inputs.qty },
            cost: { total: finalCost, breakdown: cst },
            build: { bom: bomMap }, // Explicitly decoupled Bill of Materials
            metrics: { margin: targetMargin }
        };

        if (auditMode === 'retail_only') payload.cost.breakdown = [];

        return new Response(JSON.stringify(payload), { headers: corsHeaders, status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 });
    }
});