// supabase/functions/calculate-pole-cover/index.ts
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

        // Physics Constants
        const waste = parseFloat(config.Waste_Factor) || 1.15;
        const wasteDisplay = ((waste - 1) * 100).toFixed(0) + '%';
        const risk = parseFloat(config.Factor_Risk) || 1.05;
        const targetMargin = parseFloat(config.Target_Margin_Pct) || 0.60;
        const rateShop = parseFloat(config.Rate_Shop_Labor) || 150.00;
        const rateCnc = parseFloat(config.Rate_CNC_Labor) || 150.00;

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
        // Frame is a 12-edge box (4x Width, 4x Depth, 4x Height)
        const frameLF_per = ((inputs.w * 4) + (inputs.d * 4) + (inputs.h * 4)) / 12;
        // 4 Braces (assumed spanning Width to hug the pole)
        const braceLF_per = (inputs.w * 4) / 12; 
        
        const totalFrameLF = frameLF_per * inputs.qty;
        const totalBraceLF = braceLF_per * inputs.qty;
        
        const frameSize = parseFloat(inputs.frameMat) || 1.5;
        const frameCostLF = parseFloat(config[`Cost_Frame_AlumTube_${frameSize}_1/8`]) || 1.45;
        const braceCostLF = parseFloat(config[`Cost_Frame_AlumAngle_1.5_1/8`]) || 1.15;

        // Yield calculation for 24' Aluminum Sticks
        const frameSticks = Math.ceil(totalFrameLF / 24);
        const braceSticks = Math.ceil(totalBraceLF / 24);

        addBOM('Metal Fabrication', {
            name: `Aluminum Skeleton Frame (${frameSize}" Tube)`,
            pull: `${frameSticks}x 24' Sticks (${frameSticks * 24} LF)`,
            cut: `${4 * inputs.qty}x @ ${inputs.w}", ${4 * inputs.qty}x @ ${inputs.d}", ${4 * inputs.qty}x @ ${inputs.h}"`,
            drop: `${((frameSticks * 24) - totalFrameLF).toFixed(1)} LF`
        });

        addBOM('Metal Fabrication', {
            name: `Mounting Braces (1.5" Alum Angle)`,
            pull: `${braceSticks}x 24' Sticks (${braceSticks * 24} LF)`,
            cut: `${4 * inputs.qty}x @ ${inputs.w}"`,
            drop: `${((braceSticks * 24) - totalBraceLF).toFixed(1)} LF`
        });

        L('METAL_MAT', `Aluminum Skeleton (${frameSize}" Tube)`, totalFrameLF * frameCostLF * waste, `${totalFrameLF.toFixed(1)} LF * $${frameCostLF.toFixed(2)}/LF * ${wasteDisplay} Waste`);
        L('METAL_MAT', `Bracing Angles (1.5" Angle)`, totalBraceLF * braceCostLF * waste, `${totalBraceLF.toFixed(1)} LF * $${braceCostLF.toFixed(2)}/LF * ${wasteDisplay} Waste`);

        // 2. STEEL BRACKET FABRICATION
        const bracketsPer = 4;
        const totalBrackets = bracketsPer * inputs.qty;
        const steelLF = (totalBrackets * 3) / 12; // 3 inches of steel angle per bracket
        const steelCostLF = parseFloat(config.Cost_Frame_SteelAngle_2_1/8) || 1.45;

        addBOM('Metal Fabrication', {
            name: `Steel Pole Brackets (2" Angle)`,
            pull: `${Math.ceil(steelLF)} LF`,
            cut: `${totalBrackets}x @ 3.0"`,
            drop: `--`
        });

        L('METAL_MAT', `Steel Brackets (Raw Material)`, steelLF * steelCostLF * waste, `${totalBrackets} Brackets (3" ea = ${steelLF.toFixed(1)} LF) * $${steelCostLF.toFixed(2)}/LF`);
        
        // Bracket Fabrication Labor (Cut, Drill, Weld-Prep)
        const bracketFabMins = totalBrackets * 5; 
        addLabor('Metal Fabrication', 'Fabricate Steel Pole Brackets', bracketFabMins);
        L('METAL_LAB', `Bracket Fabrication`, (bracketFabMins / 60) * rateShop, `${totalBrackets} Brackets * 5 Mins/ea * $${rateShop}/hr`);

        // 3. FACE PANELS
        const sqftW = (inputs.w * inputs.h) / 144;
        const sqftD = (inputs.d * inputs.h) / 144;
        const sqftPerUnit = (sqftW * 2) + (sqftD * 2);
        const totalSqFt = sqftPerUnit * inputs.qty;

        let faceCost = 98.12; // .063 Default
        if (inputs.faceThk === '.040') faceCost = parseFloat(config.Cost_Stock_040_4x8) || 84.44;
        if (inputs.faceThk === '.063') faceCost = parseFloat(config.Cost_Stock_063_4x8) || 98.12;
        if (inputs.faceThk === '.080') faceCost = parseFloat(config.Cost_Stock_080_4x8) || 124.57;
        
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

        L('METAL_MAT', `Skin Panels (${faceName})`, totalSqFt * faceCostSqFt * waste, `${totalSqFt.toFixed(1)} SF * $${faceCostSqFt.toFixed(2)}/SF * ${wasteDisplay} Waste`);

        // 4. ADHESIVE & MECHANICAL FASTENERS
        // 3 sides glued, 1 side screwed. 
        // Edges per glued panel = 2xH + 2xW. Approximate LF = 75% of total frame edges.
        const totalEdgesLF = frameLF_per * inputs.qty;
        const adhesiveLF = totalEdgesLF * 0.75; 
        const cartridges = Math.ceil(adhesiveLF / 10); // 10 LF per tube
        
        addBOM('Assembly & Hardware', {
            name: `Metal Adhesive (0.25" bead)`,
            pull: `${cartridges} Cartridges`, cut: '--', drop: '--'
        });
        L('METAL_MAT', `Structural Adhesive (3 Sides)`, cartridges * (parseFloat(config.Cost_Adhesive_Tube) || 18.71), `${adhesiveLF.toFixed(1)} LF / 10 LF per tube = ${cartridges} Tubes`);

        const accessPanelPerimeter = ((inputs.w * 2) + (inputs.h * 2)) / 12;
        const screwsNeeded = Math.ceil(accessPanelPerimeter * 1.5) * inputs.qty; // ~1.5 screws per foot
        addBOM('Assembly & Hardware', {
            name: `Self-Tapping Painted Screws (Access Panel)`,
            pull: `${screwsNeeded} Screws`, cut: '--', drop: '--'
        });
        L('INSTALL_HDW', `Mechanical Fasteners`, screwsNeeded * 0.15, `${screwsNeeded} Screws * $0.15/ea`);

        // 5. METAL LABOR (Frame welding and skinning)
        const gatherMins = 10;
        addLabor('Metal Fabrication', 'Gather Materials', gatherMins);
        L('METAL_LAB', `Gather Materials`, (gatherMins / 60) * rateShop, `10 Mins * $${rateShop}/hr`);

        const cutMins = (12 + 4) * inputs.qty * 2; // 16 pieces * 2 mins
        addLabor('Metal Fabrication', 'Saw Cuts (Frame & Braces)', cutMins);
        L('METAL_LAB', `Saw Cuts`, (cutMins / 60) * rateShop, `${16 * inputs.qty} cuts @ 2 mins * $${rateShop}/hr`);

        const weldPoints = (12 + 8) * inputs.qty; // 12 box joints + 8 brace joints
        const weldMins = weldPoints * 1.5; 
        addLabor('Metal Fabrication', 'Tack & Bead Welding', weldMins);
        L('METAL_LAB', `Frame Welding`, (weldMins / 60) * rateShop, `${weldPoints} welds @ 1.5 mins * $${rateShop}/hr`);

        const grindMins = weldPoints * 0.5;
        addLabor('Metal Fabrication', 'Weld Grinding & Cleaning', grindMins);
        L('METAL_LAB', `Weld Grinding`, (grindMins / 60) * rateShop, `${weldPoints} welds @ 0.5 mins * $${rateShop}/hr`);

        const shearMins = 5 + (16 * inputs.qty * 1); // 4 faces * 4 cuts = 16 cuts
        addLabor('Metal Fabrication', 'Shear Face Panels', shearMins);
        L('METAL_LAB', `Shear Face Panels`, (shearMins / 60) * rateShop, `5 Min Setup + (${16 * inputs.qty} Cuts * 1 Min) * $${rateShop}/hr`);

        const glueMins = adhesiveLF * 1;
        addLabor('Metal Fabrication', 'Adhesive Application (3 Sides)', glueMins);
        L('METAL_LAB', `Adhesive Application`, (glueMins / 60) * rateShop, `${adhesiveLF.toFixed(1)} LF @ 1 min/LF * $${rateShop}/hr`);

        const screwMins = accessPanelPerimeter * inputs.qty * 1.5;
        addLabor('Metal Fabrication', 'Drill/Tap Access Panel', screwMins);
        L('METAL_LAB', `Drill/Tap Access Panel`, (screwMins / 60) * rateShop, `${accessPanelPerimeter.toFixed(1)} LF @ 1.5 mins/LF * $${rateShop}/hr`);

        // 6. PAINT LOGIC
        if (inputs.paintOption === 'Custom Paint') {
            const paintCostSqFt = parseFloat(config.Cost_Paint_SqFt) || 2.50;
            
            L('PAINT_MAT', `Automotive Primer`, (totalSqFt * (paintCostSqFt * 0.4) * waste) + 1.00, `${totalSqFt.toFixed(1)} SF * $${(paintCostSqFt * 0.4).toFixed(2)}/SF * ${wasteDisplay} Waste + $1.00 Cup`);
            L('PAINT_MAT', `Automotive Paint (Color)`, (totalSqFt * (paintCostSqFt * 0.6) * waste) + 1.00, `${totalSqFt.toFixed(1)} SF * $${(paintCostSqFt * 0.6).toFixed(2)}/SF * ${wasteDisplay} Waste + $1.00 Cup`);
            
            addBOM('Paint & Finishes', {
                name: `Automotive Paint/Primer Coverage`,
                pull: `${totalSqFt.toFixed(1)} SF`, cut: '--', drop: '--'
            });

            const paintSetupMins = 15;
            addLabor('Paint & Finishes', 'Paint Mix & Setup', paintSetupMins);
            L('PAINT_LAB', `Paint Mix & Setup`, (paintSetupMins / 60) * rateShop, `${paintSetupMins} Mins * $${rateShop}/hr`);

            const prepMins = totalSqFt * 0.15;
            addLabor('Paint & Finishes', 'Sign Prep & Sanding', prepMins);
            L('PAINT_LAB', `Sign Prep`, (prepMins / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 0.15 Mins/SF * $${rateShop}/hr`);

            const sprayMins = totalSqFt * 0.40;
            addLabor('Paint & Finishes', 'Spray Primer & Color Coats', sprayMins);
            L('PAINT_LAB', `Spray Application`, (sprayMins / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 0.40 Mins/SF * $${rateShop}/hr`);
        }

        // 7. TOTALS & BIDIRECTIONAL MARGIN
        const rawHardCost = cst.reduce((s,i) => s + i.total, 0);
        const finalCost = rawHardCost * risk;
        const unitRetail = finalCost / (1 - targetMargin);

        const specs = {
            qty: inputs.qty,
            w: inputs.w,
            h: inputs.h,
            d: inputs.d,
            sides: 4,
            mountStyle: `Pole Cover (${inputs.poleSize}" OD Pole)`,
            postMetalName: 'Steel Brackets / On-Site Weld',
            frameDepth: inputs.d,
            isAngle: false,
            graphicType: inputs.paintOption,
            faceKey: faceName
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