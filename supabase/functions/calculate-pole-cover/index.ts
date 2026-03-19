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

        // Secure DB Fetcher and Formula Annotator
        const num = (k: string, fallback: string) => {
            const p = parseFloat(config[k]);
            return isNaN(p) ? parseFloat(fallback) : p;
        };
        const V = (k: string, fb: string) => `[${k}: ${num(k, fb)}]`;

        // Physics Constants
        const waste = num('Waste_Factor', "1.15");
        const wasteDisplay = ((waste - 1) * 100).toFixed(0) + '%';
        const risk = num('Factor_Risk', "1.05");
        const targetMargin = num('Target_Margin_Pct', "0.60");
        const rateShop = num('Rate_Shop_Labor', "150");
        const ratePaint = num('Rate_Paint_Labor', "150"); // Fallback to shop rate if missing

        const ret: any[] = [];
        const cst: any[] = [];
        const bomMap: Record<string, any[]> = {};
        const routingMap: Record<string, {task: string, time: number}[]> = {};

        const addBOM = (dept: string, item: any) => {
            if (!bomMap[dept]) bomMap[dept] = [];
            bomMap[dept].push(item);
        };

        const addLabor = (dept: string, task: string, timeMins: number) => {
            if (timeMins <= 0) return;
            if (!routingMap[dept]) routingMap[dept] = [];
            routingMap[dept].push({ task, time: timeMins });
        };

        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };
        const L = (category: string, label: string, total: number, formula: string) => { cst.push({label, total, formula, category}); return total; };

        // 1. FRAME & BRACING MATH
        // Outer Skeleton: 4 Widths, 4 Depths, 4 Heights. No middle brace.
        const frameLF_per = ((inputs.w * 4) + (inputs.d * 4) + (inputs.h * 4)) / 12;
        const braceLF_per = (inputs.d * 4) / 12; 
        
        const totalFrameLF = frameLF_per * inputs.qty;
        const totalBraceLF = braceLF_per * inputs.qty;
        
        const frameSize = parseFloat(inputs.frameMat) || 1.5;
        const frameKey = `Cost_Frame_AlumAngle_${frameSize}_1/8`;
        const frameCostLF = num(frameKey, "1.45");

        const braceKey = `Cost_Frame_AlumAngle_1.5_1/8`;
        const braceCostLF = num(braceKey, "1.45");

        // BOM NESTING: Combine Frame and Braces if they share the same material
        if (frameKey === braceKey) {
            const combinedLF = totalFrameLF + totalBraceLF;
            const combinedSticks = Math.ceil(combinedLF / 24);
            addBOM('Metal Fabrication', {
                name: `Aluminum Structure (${frameSize}" Angle)`,
                pull: `${combinedSticks}x 24' Sticks (${combinedSticks * 24} LF)`,
                cut: `${4 * inputs.qty}x @ ${inputs.w}", ${4 * inputs.qty}x @ ${inputs.h}" (Frame), ${8 * inputs.qty}x @ ${inputs.d}" (Frame & Braces)`,
                drop: `${((combinedSticks * 24) - combinedLF).toFixed(1)} LF`
            });
            L('METAL_MAT', `Aluminum Structure (${frameSize}" Angle)`, combinedLF * frameCostLF * waste, `${combinedLF.toFixed(1)} LF * $${frameCostLF.toFixed(2)}/LF ${V(frameKey, "1.45")} * ${wasteDisplay} Waste`);
        } else {
            const frameSticks = Math.ceil(totalFrameLF / 24);
            addBOM('Metal Fabrication', {
                name: `Aluminum Skeleton Frame (${frameSize}" Angle)`,
                pull: `${frameSticks}x 24' Sticks (${frameSticks * 24} LF)`,
                cut: `${4 * inputs.qty}x @ ${inputs.w}", ${4 * inputs.qty}x @ ${inputs.d}", ${4 * inputs.qty}x @ ${inputs.h}"`,
                drop: `${((frameSticks * 24) - totalFrameLF).toFixed(1)} LF`
            });
            L('METAL_MAT', `Aluminum Skeleton (${frameSize}" Angle)`, totalFrameLF * frameCostLF * waste, `${totalFrameLF.toFixed(1)} LF * $${frameCostLF.toFixed(2)}/LF ${V(frameKey, "1.45")} * ${wasteDisplay} Waste`);

            const braceSticks = Math.ceil(totalBraceLF / 24);
            addBOM('Metal Fabrication', {
                name: `Mounting Braces (1.5" Alum Angle)`,
                pull: `${braceSticks}x 24' Sticks (${braceSticks * 24} LF)`,
                cut: `${4 * inputs.qty}x @ ${inputs.d}"`,
                drop: `${((braceSticks * 24) - totalBraceLF).toFixed(1)} LF`
            });
            L('METAL_MAT', `Bracing Angles (1.5" Angle)`, totalBraceLF * braceCostLF * waste, `${totalBraceLF.toFixed(1)} LF * $${braceCostLF.toFixed(2)}/LF ${V(braceKey, "1.45")} * ${wasteDisplay} Waste`);
        }

        // 2. STEEL BRACKET FABRICATION
        const bracketsPer = 4;
        const totalBrackets = bracketsPer * inputs.qty;
        const bracketLength = Math.max(1, inputs.poleSize - 1); 
        const steelLF = (totalBrackets * bracketLength) / 12; 
        
        const steelKey = inputs.bracketMat;
        const steelCostLF = num(steelKey, "1.45");
        const steelSizeTxt = inputs.bracketMat.includes('1.5') ? '1.5"' : (inputs.bracketMat.includes('3') ? '3"' : '2"');

        addBOM('Metal Fabrication', {
            name: `Steel Pole Brackets (${steelSizeTxt} Angle)`,
            pull: `${Math.ceil(steelLF)} LF`,
            cut: `${totalBrackets}x @ ${bracketLength}.0"`,
            drop: `--`
        });

        L('METAL_MAT', `Steel Brackets (${steelSizeTxt} Angle)`, steelLF * steelCostLF * waste, `${totalBrackets} Brackets (${bracketLength}" ea = ${steelLF.toFixed(1)} LF) * $${steelCostLF.toFixed(2)}/LF ${V(steelKey, "1.45")}`);
        
        // 3. FACE PANELS
        const sqftW = (inputs.w * inputs.h) / 144;
        const sqftD = (inputs.d * inputs.h) / 144;
        const sqftPerUnit = (sqftW * 2) + (sqftD * 2);
        const totalSqFt = sqftPerUnit * inputs.qty;

        let faceCostKey = 'Cost_Stock_040_4x8';
        if (inputs.faceThk === '.063') faceCostKey = 'Cost_Stock_063_4x8';
        if (inputs.faceThk === '.080') faceCostKey = 'Cost_Stock_080_4x8';
        const faceCost = num(faceCostKey, "84.44");
        
        const faceCostSqFt = faceCost / 32;
        const sheetsNeeded = Math.ceil(totalSqFt / 32);

        let faceName = `${inputs.faceThk} Aluminum`;
        if (inputs.faceThk === '.040') faceName = `0.040 Aluminum (White/Black Reversible)`;

        addBOM('Metal Fabrication', {
            name: `Skin Panels (${faceName})`,
            pull: `${sheetsNeeded}x 4x8 Sheets`,
            cut: `${2 * inputs.qty}x @ ${inputs.w}"x${inputs.h}" & ${2 * inputs.qty}x @ ${inputs.d}"x${inputs.h}"`,
            drop: `${((sheetsNeeded * 32) - totalSqFt).toFixed(1)} SqFt`
        });

        L('METAL_MAT', `Skin Panels (${faceName})`, totalSqFt * faceCostSqFt * waste, `${totalSqFt.toFixed(1)} SF * $${faceCostSqFt.toFixed(2)}/SF ${V(faceCostKey, "84.44")} * ${wasteDisplay} Waste`);

        // 4. ADHESIVE & MECHANICAL FASTENERS
        const adhesiveLF = ((inputs.w * 4) + (inputs.d * 2) + (inputs.h * 2)) * inputs.qty / 12;
        const cartridges = Math.ceil(adhesiveLF / 10); 
        const adhesiveCost = num('Cost_Adhesive_Tube', "18.71");
        
        addBOM('Assembly & Hardware', {
            name: `Metal Adhesive (0.25" bead)`,
            pull: `${cartridges} Cartridges`, cut: '--', drop: '--'
        });
        L('METAL_MAT', `Structural Adhesive (3 Sides)`, cartridges * adhesiveCost, `${adhesiveLF.toFixed(1)} LF / 10 LF per tube = ${cartridges} Tubes * $${adhesiveCost.toFixed(2)}/ea ${V('Cost_Adhesive_Tube', "18.71")}`);

        const spaces = Math.ceil(inputs.h / 7);
        const screwsNeeded = (spaces + 1) * 2 * inputs.qty; 
        const screwCost = 0.035;

        addBOM('Assembly & Hardware', {
            name: `Self-Drilling Screws (1" Mod. Truss, 8mm Head)`,
            pull: `${screwsNeeded} Screws`, cut: '--', drop: '--'
        });
        L('INSTALL_HDW', `Mechanical Fasteners`, screwsNeeded * screwCost, `${screwsNeeded} Screws (Spaced ~7" on access panel) * $${screwCost}/ea`);

        // Paint Hardware Heads
        L('PAINT_MAT', `Primer Cup (Fasteners)`, 1.00, `Small mix to match fastener heads`);
        L('PAINT_MAT', `Paint Cup (Fasteners)`, 1.00, `Small mix to match fastener heads`);

        // 5. METAL LABOR (Sequential Workflow)
        const gatherMins = 10;
        addLabor('Metal Fabrication', 'Gather Materials', gatherMins);
        L('METAL_LAB', `Gather Materials`, (gatherMins / 60) * rateShop, `10 Mins * $${rateShop}/hr ${V('Rate_Shop_Labor', "150")}`);

        const shearMins = 5 + (16 * inputs.qty * 1); 
        addLabor('Metal Fabrication', 'Shear Face Panels', shearMins);
        L('METAL_LAB', `Shear Face Panels`, (shearMins / 60) * rateShop, `5 Min Setup + (${16 * inputs.qty} Cuts * 1 Min) * $${rateShop}/hr ${V('Rate_Shop_Labor', "150")}`);

        const alumCuts = 16 * inputs.qty; // 12 frame + 4 braces
        const totalCuts = alumCuts + totalBrackets;
        const cutMins = totalCuts * 1; 
        addLabor('Metal Fabrication', 'Saw Cuts', cutMins);
        L('METAL_LAB', `Saw Cuts (Alum & Steel)`, (cutMins / 60) * rateShop, `${totalCuts} cuts @ 1 min/cut * $${rateShop}/hr ${V('Rate_Shop_Labor', "150")}`);

        const weldPoints = (12 + 8) * inputs.qty; // 12 box joints + 8 brace joints
        const weldMins = weldPoints * 0.5; 
        addLabor('Metal Fabrication', 'Tack & Bead Welding', weldMins);
        L('METAL_LAB', `Frame Welding`, (weldMins / 60) * rateShop, `${weldPoints} welds @ 0.5 mins * $${rateShop}/hr ${V('Rate_Shop_Labor', "150")}`);

        const grindMins = weldPoints * 0.33;
        addLabor('Metal Fabrication', 'Weld Grinding & Cleaning', grindMins);
        L('METAL_LAB', `Weld Grinding & Cleaning`, (grindMins / 60) * rateShop, `${weldPoints} welds @ 0.33 mins * $${rateShop}/hr ${V('Rate_Shop_Labor', "150")}`);

        const glueMins = adhesiveLF * (10 / 60); // 10 secs per LF
        addLabor('Metal Fabrication', 'Adhesive Application', glueMins);
        L('METAL_LAB', `Adhesive Application`, (glueMins / 60) * rateShop, `${adhesiveLF.toFixed(1)} LF @ 10 sec/LF * $${rateShop}/hr ${V('Rate_Shop_Labor', "150")}`);

        const screwMins = screwsNeeded * (10 / 60); // 10 secs per screw
        addLabor('Metal Fabrication', 'Drill/Tap Access Panel', screwMins);
        L('METAL_LAB', `Drill/Tap Access Panel`, (screwMins / 60) * rateShop, `${screwsNeeded} Screws @ 10 sec/ea * $${rateShop}/hr ${V('Rate_Shop_Labor', "150")}`);

        // 6. PAINT LOGIC
        const screwMixMins = 10;
        const screwSprayMins = screwsNeeded * 0.1;
        const screwPaintMins = screwMixMins + screwSprayMins;
        addLabor('Paint & Finishes', 'Mix & Spray Fasteners', screwPaintMins);
        L('PAINT_LAB', `Mix & Spray Fasteners`, (screwPaintMins / 60) * ratePaint, `10 Min Mix + (${screwsNeeded} Screws * 0.1 Min) * $${ratePaint}/hr ${V('Rate_Paint_Labor', "150")}`);

        if (inputs.paintOption === 'Custom Paint') {
            const paintCostSqFt = num('Cost_Paint_SqFt', "2.50");
            
            L('PAINT_MAT', `Automotive Primer`, (totalSqFt * (paintCostSqFt * 0.4) * waste) + 1.00, `${totalSqFt.toFixed(1)} SF * $${(paintCostSqFt * 0.4).toFixed(2)}/SF ${V('Cost_Paint_SqFt', "2.50")} * ${wasteDisplay} Waste + $1.00 Cup`);
            L('PAINT_MAT', `Automotive Paint (Color)`, (totalSqFt * (paintCostSqFt * 0.6) * waste) + 1.00, `${totalSqFt.toFixed(1)} SF * $${(paintCostSqFt * 0.6).toFixed(2)}/SF ${V('Cost_Paint_SqFt', "2.50")} * ${wasteDisplay} Waste + $1.00 Cup`);
            
            addBOM('Paint & Finishes', {
                name: `Automotive Paint/Primer Coverage`,
                pull: `${totalSqFt.toFixed(1)} SF`, cut: '--', drop: '--'
            });

            const paintSetupMins = 15;
            addLabor('Paint & Finishes', 'Paint Mix & Setup', paintSetupMins);
            L('PAINT_LAB', `Paint Mix & Setup`, (paintSetupMins / 60) * ratePaint, `${paintSetupMins} Mins * $${ratePaint}/hr ${V('Rate_Paint_Labor', "150")}`);

            const prepMins = totalSqFt * 0.15;
            addLabor('Paint & Finishes', 'Sign Prep & Sanding', prepMins);
            L('PAINT_LAB', `Sign Prep`, (prepMins / 60) * ratePaint, `${totalSqFt.toFixed(1)} SF * 0.15 Mins/SF * $${ratePaint}/hr ${V('Rate_Paint_Labor', "150")}`);

            const sprayMins = totalSqFt * 0.40;
            addLabor('Paint & Finishes', 'Spray Primer & Color Coats', sprayMins);
            L('PAINT_LAB', `Spray Application`, (sprayMins / 60) * ratePaint, `${totalSqFt.toFixed(1)} SF * 0.40 Mins/SF * $${ratePaint}/hr ${V('Rate_Paint_Labor', "150")}`);
        }

        // 7. TOTALS & BIDIRECTIONAL MARGIN
        const rawHardCost = cst.reduce((s,i) => s + i.total, 0);
        const finalCost = rawHardCost * risk;
        const unitRetail = finalCost / (1 - targetMargin);

        const specs = {
            product: 'PoleCover',
            qty: inputs.qty, w: inputs.w, h: inputs.h, d: inputs.d,
            sides: 4, mountStyle: `Pole Cover (${inputs.poleSize}" OD Pole)`,
            postMetalName: 'Steel Brackets / On-Site Weld',
            frameDepth: inputs.d, isAngle: true,
            graphicType: inputs.paintOption, faceKey: faceName
        };

        const payload = {
            retail: { unitPrice: unitRetail, grandTotal: unitRetail * inputs.qty },
            cost: { total: finalCost, breakdown: cst },
            build: { bom: bomMap, routing: routingMap, specs: specs },
            metrics: { margin: targetMargin }
        };

        if (auditMode === 'retail_only') payload.cost.breakdown = [];
        return new Response(JSON.stringify(payload), { headers: corsHeaders, status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 });
    }
});