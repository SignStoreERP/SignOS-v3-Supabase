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
        const auditMode = requestData.audit_mode || 'full'; 

        // Physics Constants & Global Overrides
        const waste = parseFloat(config.Waste_Factor) || 1.15;
        const wasteDisplay = ((waste - 1) * 100).toFixed(0) + '%';
        const risk = parseFloat(config.Factor_Risk) || 1.05;
        const targetMargin = parseFloat(config.Target_Margin_Pct) || 0.60;
        const rateShop = parseFloat(config.Rate_Shop_Labor) || 150.00;
        const rateCnc = parseFloat(config.Rate_CNC_Labor) || 150.00;

        const ret: any[] = [];
        const cst: any[] = [];
        
        const bomMap: Record<string, string[]> = {};
        const routingMap: Record<string, {task: string, time: number}[]> = {};

        const addBOM = (dept: string, amount: string, item: string) => {
            if (!bomMap[dept]) bomMap[dept] = [];
            bomMap[dept].push(`${amount} | ${item}`);
        };

        const addLabor = (dept: string, task: string, timeMins: number) => {
            if (timeMins <= 0) return;
            if (!routingMap[dept]) routingMap[dept] = [];
            routingMap[dept].push({ task, time: timeMins });
        };

        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };
        const L = (category: string, label: string, total: number, formula: string) => { cst.push({label, total, formula, category}); return total; };

        // 1. POST MATH
        const postInchesPer = inputs.thag + inputs.belowGrade;
        const postLFPer = Math.ceil(postInchesPer / 12);
        const totalPostLF = postLFPer * 2 * inputs.qty;
        
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

        const holeRadiusFt = ((inputs.postSize * 3) / 2) / 12;
        const footerHeightFt = (inputs.belowGrade * 0.66) / 12;
        const holeVolumeCuFt = Math.PI * Math.pow(holeRadiusFt, 2) * footerHeightFt;
        const bagsNeeded = Math.ceil((holeVolumeCuFt * 2) / 0.6) * inputs.qty;
        addBOM('Installation Hardware', `${bagsNeeded} Bags`, `Concrete (80lb)`);

        // 2. FRAME MATH
        let frameLF = 0;
        let cutCount = 2; 
        let weldPoints = 0;

        if (inputs.mountStyle === 'Flush') {
            const hBarInches = inputs.w - (inputs.postSize * 2);
            frameLF = Math.ceil(hBarInches / 12) * 2; 
            cutCount += 2; 
            weldPoints = 8; 
        } else {
            frameLF = (Math.ceil(inputs.w / 12) * 2) + (Math.ceil(inputs.h / 12) * 2);
            cutCount += 4; 
            weldPoints = 16; 
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
        let totalSqFt = sqftPerFace * inputs.sides * inputs.qty;
        
        const sheetCost = parseFloat(config[inputs.faceKey]) || 98.12; 
        const faceCostSqFt = sheetCost / 32; 

        L('METAL_MAT', `Sign Faces (${inputs.sides} Sided)`, totalSqFt * faceCostSqFt * waste, `${totalSqFt.toFixed(1)} SF * $${faceCostSqFt.toFixed(2)}/sf [[${inputs.faceKey}]] * ${wasteDisplay} Waste`);
        addBOM('Metal Fabrication', `${totalSqFt.toFixed(1)} SF`, `Sign Faces (${inputs.sides} Sided)`);

        if (inputs.isAngle) {
            const capSqFt = (inputs.w * inputs.frameDepth * 2) / 144; 
            const totalCapSqFt = capSqFt * inputs.qty;
            
            L('METAL_MAT', `Sign Faces (Top/Bottom Caps)`, totalCapSqFt * faceCostSqFt * waste, `${totalCapSqFt.toFixed(1)} SF * $${faceCostSqFt.toFixed(2)}/sf [[${inputs.faceKey}]] * ${wasteDisplay} Waste`);
            addBOM('Metal Fabrication', `${totalCapSqFt.toFixed(1)} SF`, `Face Material (Top/Bottom Caps)`);
            totalSqFt += totalCapSqFt; 
        }

        const perimeterInches = (inputs.w * 2 + inputs.h * 2) * inputs.sides * inputs.qty;
        const perimeterLF = perimeterInches / 12;
        const cartridges = Math.ceil(perimeterLF / 10); 
        
        L('METAL_MAT', `Structural Adhesive`, cartridges * (parseFloat(config.Cost_Adhesive_Tube) || 18.71), `${perimeterLF.toFixed(1)} LF (0.25" bead) / 10 LF per tube`);
        addBOM('Metal Fabrication', `${cartridges} Cartridges`, `Lord's Adhesive (0.25" bead)`);

        // 4. METAL LABOR (With dedicated routing tracker)
        const gatherMins = 10;
        L('METAL_LAB', `Gather Materials`, (gatherMins / 60) * rateShop, `10 Mins * $${rateShop}/hr`);
        addLabor('Metal Fabrication', 'Gather Materials', gatherMins);
        
        const totalCuts = cutCount * inputs.qty;
        const cutMins = totalCuts * 2;
        L('METAL_LAB', `Saw Cuts (Posts & Frame)`, (cutMins / 60) * rateShop, `${totalCuts} cuts @ 2 mins * $${rateShop}/hr`);
        addLabor('Metal Fabrication', 'Saw Cuts (Posts & Frame)', cutMins);
        
        const totalWelds = weldPoints * inputs.qty;
        const weldMins = totalWelds * 0.5;
        L('METAL_LAB', `Tack Welding`, (weldMins / 60) * rateShop, `${totalWelds} welds @ 0.5 mins * $${rateShop}/hr`);
        addLabor('Metal Fabrication', 'Tack Welding', weldMins);

        const grindMins = totalWelds * 0.33;
        L('METAL_LAB', `Weld Grinding & Cleaning`, (grindMins / 60) * rateShop, `${totalWelds} welds @ 0.33 mins * $${rateShop}/hr`);
        addLabor('Metal Fabrication', 'Weld Grinding & Cleaning', grindMins);
        
        const glueMins = perimeterLF * 1;
        L('METAL_LAB', `Adhesive Application`, (glueMins / 60) * rateShop, `${perimeterLF.toFixed(1)} LF @ 1 min/LF * $${rateShop}/hr`);
        addLabor('Metal Fabrication', 'Adhesive Application', glueMins);

        if (inputs.faceKey.includes('ACM')) {
            const cncMins = 10 + (totalSqFt * 1);
            L('METAL_LAB', `CNC Router Setup & Run`, (cncMins / 60) * rateCnc, `10 Min Setup + (1 Min/SF Run) * $${rateCnc}/hr`);
            addLabor('Metal Fabrication', 'CNC Router Setup & Run', cncMins);
        } else {
            const shearMins = 5 + (4 * inputs.sides * inputs.qty * 1);
            L('METAL_LAB', `Shear Setup & Run`, (shearMins / 60) * rateShop, `5 Min Setup + (4 Cuts * 1 Min) * $${rateShop}/hr`);
            addLabor('Metal Fabrication', 'Shear Setup & Run', shearMins);
        }

        const postArea = ((totalPostLF * inputs.postSize * 4) / 12);
        const paintArea = (inputs.graphicType === 'NoPaint_Print') ? postArea : postArea + totalSqFt;

        // 5. PAINT LOGIC
        if (inputs.graphicType === 'Paint_Print' || inputs.graphicType === 'Paint_Vinyl') {
            const paintCostSqFt = parseFloat(config.Cost_Paint_SqFt) || 2.50;
            L('PAINT_MAT', `Automotive Primer`, (paintArea * (paintCostSqFt * 0.4) * waste) + 1.00, `${paintArea.toFixed(1)} SF * $${(paintCostSqFt * 0.4).toFixed(2)}/SF * ${wasteDisplay} Waste + $1.00 Cup`);
            L('PAINT_MAT', `Automotive Paint (Color)`, (paintArea * (paintCostSqFt * 0.6) * waste) + 1.00, `${paintArea.toFixed(1)} SF * $${(paintCostSqFt * 0.6).toFixed(2)}/SF * ${wasteDisplay} Waste + $1.00 Cup`);
            addBOM('Paint & Finishes', `${paintArea.toFixed(1)} SF`, `Automotive Paint/Primer Coverage`);

            const paintSetupMins = 4;
            L('PAINT_LAB', `Paint Mix & Setup`, (paintSetupMins / 60) * rateShop, `4 Mins Flat * $${rateShop}/hr`);
            addLabor('Paint & Finishes', 'Paint Mix & Setup', paintSetupMins);

            const prepMins = paintArea * 0.15;
            L('PAINT_LAB', `Sign Prep (Metal Fab Hand-off)`, (prepMins / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.15 Mins/SF * $${rateShop}/hr`);
            addLabor('Paint & Finishes', 'Sign Prep', prepMins);

            const primeMins = paintArea * 0.10;
            L('PAINT_LAB', `Primer Coat`, (primeMins / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.10 Mins/SF * $${rateShop}/hr`);
            addLabor('Paint & Finishes', 'Primer Coat', primeMins);

            const finMins = paintArea * 0.30;
            L('PAINT_LAB', `Finish Coat (Color)`, (finMins / 60) * rateShop, `${paintArea.toFixed(1)} SF * 0.30 Mins/SF * $${rateShop}/hr`);
            addLabor('Paint & Finishes', 'Finish Coat (Color)', finMins);
        }

        // 6. GRAPHICS LOGIC
        const ripMins = 5;
        L('VINYL_LAB', `Job Setup (File RIP)`, (ripMins / 60) * rateShop, `5 Mins * $${rateShop}/hr`);
        addLabor('Vinyl & Graphics', 'Job Setup (File RIP)', ripMins);

        const isPrint = inputs.graphicType.includes('Print');
        const mediaName = isPrint ? '3M IJ180 Cast Wrap' : 'Oracal 751 High Perf';

        L('VINYL_MAT', `Cast Vinyl Media (${mediaName})`, totalSqFt * (parseFloat(config.Cost_Vin_Cast)||1.30) * waste, `${totalSqFt.toFixed(1)} SF * $1.30/SF * ${wasteDisplay} Waste`);
        addBOM('Vinyl & Graphics', `${totalSqFt.toFixed(1)} SF`, `Vinyl Media (${mediaName})`);
        
        if (isPrint) {
            L('VINYL_MAT', `Latex Ink`, totalSqFt * (parseFloat(config.Cost_Ink_Latex)||0.16) * waste, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${wasteDisplay} Waste`);
            L('VINYL_MAT', `Overlaminate Media (3M 8518)`, totalSqFt * (parseFloat(config.Cost_Lam_Cast)||0.96) * waste, `${totalSqFt.toFixed(1)} SF * $0.96/SF * ${wasteDisplay} Waste`);
            addBOM('Vinyl & Graphics', `${totalSqFt.toFixed(1)} SF`, `Overlaminate (3M 8518 Cast)`);
            
            const printRunMins = (totalSqFt / 150) * 60;
            L('VINYL_LAB', `Print Machine Run`, (printRunMins / 60) * (parseFloat(config.Rate_Machine_Print)||5), `150 SF/Hr Speed * $5/hr`);
            addLabor('Vinyl & Graphics', 'Print Machine Run', printRunMins);

            const lamRunMins = (totalSqFt / 300) * 60;
            L('VINYL_LAB', `Lamination Machine Run`, (lamRunMins / 60) * rateShop, `300 SF/Hr Speed * $${rateShop}/hr`);
            addLabor('Vinyl & Graphics', 'Lamination Machine Run', lamRunMins);
        }
        
        const maskLF = totalSqFt / 4; 
        L('VINYL_MAT', `Transfer Tape (Masking)`, totalSqFt * (parseFloat(config.Cost_Transfer_Tape)||0.15) * waste, `${totalSqFt.toFixed(1)} SF * $0.15/SF * ${wasteDisplay} Waste`);
        addBOM('Vinyl & Graphics', `${maskLF.toFixed(1)} LF`, `Transfer Tape Mask (48" W)`);

        if (isPrint || inputs.graphicType === 'Paint_Vinyl') {
            const cutRunMins = (totalSqFt / 50) * 60;
            L('VINYL_LAB', `Plotter/Cutter Run`, (cutRunMins / 60) * (parseFloat(config.Rate_Machine_Cut)||5), `50 SF/Hr Speed * $5/hr`);
            addLabor('Vinyl & Graphics', 'Plotter/Cutter Run', cutRunMins);
        }

        if (inputs.graphicType !== 'NoPaint_Print') {
            const weedMinsPerSF = inputs.weedingLevel === 'Complex' ? 0.50 : 0.25;
            const weedMins = totalSqFt * weedMinsPerSF;
            L('VINYL_LAB', `Weeding Labor`, (weedMins / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * ${weedMinsPerSF} Mins/SF * $${rateShop}/hr`);
            addLabor('Vinyl & Graphics', 'Weeding Labor', weedMins);
        }
        
        const maskMins = maskLF * (5 / 60); 
        L('VINYL_LAB', `Masking Labor`, (maskMins / 60) * rateShop, `${maskLF.toFixed(1)} LF (@48" W) * 5 Sec/LF * $${rateShop}/hr`);
        addLabor('Vinyl & Graphics', 'Masking Labor', maskMins);
        
        const installMins = totalSqFt * 0.333;
        L('VINYL_LAB', `Graphics Installation (Shop)`, (installMins / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 20 Sec/SF * $${rateShop}/hr`);
        addLabor('Vinyl & Graphics', 'Graphics Installation', installMins);

        // 7. TOTALS & BIDIRECTIONAL MARGIN
        const rawHardCost = cst.reduce((s,i) => s + i.total, 0);
        const finalCost = rawHardCost * risk;
        const unitRetail = finalCost / (1 - targetMargin);

        const payload = {
            retail: { unitPrice: unitRetail, grandTotal: unitRetail * inputs.qty },
            cost: { total: finalCost, breakdown: cst },
            build: { bom: bomMap, routing: routingMap },
            metrics: { margin: targetMargin }
        };

        if (auditMode === 'retail_only') payload.cost.breakdown = [];

        return new Response(JSON.stringify(payload), { headers: corsHeaders, status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 });
    }
});