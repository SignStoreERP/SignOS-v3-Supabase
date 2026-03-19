declare const Deno: any;
import { Agent_Material_Stock } from "../_shared/agents/Agent_Material_Stock.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req: any) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const authHeader = req.headers.get('Authorization') || '';
        const requestData = await req.json();
        const inputs = requestData.inputs || {};
        const config = requestData.config || {};
        const auditMode = requestData.audit_mode || 'full'; 

        // THE NO FALLBACK MANDATE
        const num = (k: string) => {
            const p = parseFloat(config[k]);
            if (isNaN(p)) throw new Error(`[NO FALLBACK MANDATE] Missing Global Variable: [${k}]. Calculation Halted.`);
            return p;
        };
        const V = (k: string) => `[${k}: ${num(k)}]`;

        // Physics Constants
        const risk = num('Factor_Risk');
        const targetMargin = num('Target_Margin_Pct');
        const rateShop = num('Rate_Shop_Labor');
        const ratePaint = num('Rate_Paint_Labor');
        const adhesiveCost = num('Cost_Adhesive_Tube');
        const screwCost = num('Cost_Hardware_Screw_ModTruss');
        const paintCupCost = num('Cost_Paint_Cup_Small');

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
        const L = (category: string, label: string, total: number, formula: string, meta: any = {}) => { 
            cst.push({label, total, formula, category, meta}); 
            return total; 
        };

        // --- SKU MAPPING ---
        const faceSkuMap: Record<string, string> = { '.040': 'ALM_SHT_040', '.063': 'ALM_SHT_063', '.080': 'ALM_SHT_080' };
        const faceSku = faceSkuMap[inputs.faceThk] || 'ALM_SHT_040';
        
        const frameSize = parseFloat(inputs.frameMat) || 1.5;
        const frameSku = frameSize === 1 ? 'ALM_ANG_1' : 'ALM_ANG_1.5';
        const braceSku = 'ALM_ANG_1.5';

        let bracketSku = 'STL_ANG_1.5';
        if (inputs.bracketMat.includes('2_1/8')) bracketSku = 'STL_ANG_2';
        if (inputs.bracketMat.includes('3_1/4')) bracketSku = 'STL_ANG_3';

        // --- UNIVERSAL AGENT FETCH ---
        const faceMat = await Agent_Material_Stock.fetchMaterial(faceSku, authHeader);
        const frameMat = await Agent_Material_Stock.fetchMaterial(frameSku, authHeader);
        const braceMat = await Agent_Material_Stock.fetchMaterial(braceSku, authHeader);
        const bracketMat = await Agent_Material_Stock.fetchMaterial(bracketSku, authHeader);

        // 1. FRAME & BRACING MATH
        const frameLF_per = ((inputs.w * 4) + (inputs.d * 4) + (inputs.h * 4)) / 12;
        const braceLF_per = (inputs.d * 4) / 12; 

        const frameYield = Agent_Material_Stock.calculateLinearYield(frameLF_per * 12, inputs.qty, frameMat, 24);
        const braceYield = Agent_Material_Stock.calculateLinearYield(braceLF_per * 12, inputs.qty, braceMat, 24);

        if (frameSku === braceSku) {
            const combinedLF = frameYield.totalLF + braceYield.totalLF;
            const combinedYield = Agent_Material_Stock.calculateLinearYield(combinedLF * 12, 1, frameMat, 24);
            
            addBOM('Metal Fabrication', {
                name: `Aluminum Structure (${frameMat.description})`,
                pull: `${combinedYield.sticksNeeded}x 24' Sticks (${combinedYield.sticksNeeded * 24} LF)`,
                cut: `${4 * inputs.qty}x @ ${inputs.w}", ${4 * inputs.qty}x @ ${inputs.h}" (Frame), ${8 * inputs.qty}x @ ${inputs.d}" (Frame & Braces)`,
                drop: `${combinedYield.dropLF.toFixed(1)} LF`
            });
            L('METAL_MAT', `Aluminum Structure (${frameMat.description})`, combinedYield.totalCost, `${combinedYield.totalLF.toFixed(1)} LF * $${combinedYield.costPerLF.toFixed(2)}/LF [${frameSku}] * ${combinedYield.wasteFactor} Waste`);
        } else {
            addBOM('Metal Fabrication', {
                name: `Aluminum Skeleton Frame (${frameMat.description})`,
                pull: `${frameYield.sticksNeeded}x 24' Sticks (${frameYield.sticksNeeded * 24} LF)`,
                cut: `${4 * inputs.qty}x @ ${inputs.w}", ${4 * inputs.qty}x @ ${inputs.d}", ${4 * inputs.qty}x @ ${inputs.h}"`,
                drop: `${frameYield.dropLF.toFixed(1)} LF`
            });
            L('METAL_MAT', `Aluminum Skeleton (${frameMat.description})`, frameYield.totalCost, `${frameYield.totalLF.toFixed(1)} LF * $${frameYield.costPerLF.toFixed(2)}/LF [${frameSku}] * ${frameYield.wasteFactor} Waste`);

            addBOM('Metal Fabrication', {
                name: `Mounting Braces (${braceMat.description})`,
                pull: `${braceYield.sticksNeeded}x 24' Sticks (${braceYield.sticksNeeded * 24} LF)`,
                cut: `${4 * inputs.qty}x @ ${inputs.d}"`,
                drop: `${braceYield.dropLF.toFixed(1)} LF`
            });
            L('METAL_MAT', `Bracing Angles (${braceMat.description})`, braceYield.totalCost, `${braceYield.totalLF.toFixed(1)} LF * $${braceYield.costPerLF.toFixed(2)}/LF [${braceSku}] * ${braceYield.wasteFactor} Waste`);
        }

        // 2. STEEL BRACKET FABRICATION
        const bracketsPer = 4;
        const totalBrackets = bracketsPer * inputs.qty;
        const bracketLength = Math.max(1, inputs.poleSize - 1); 
        const steelYield = Agent_Material_Stock.calculateLinearYield(bracketLength, totalBrackets, bracketMat, 20);

        addBOM('Metal Fabrication', {
            name: `Steel Pole Brackets (${bracketMat.description})`,
            pull: `${Math.ceil(steelYield.totalLF)} LF`,
            cut: `${totalBrackets}x @ ${bracketLength}.0"`,
            drop: `--`
        });
        L('METAL_MAT', `Steel Brackets (${bracketMat.description})`, steelYield.totalCost, `${totalBrackets} Brackets (${bracketLength}" ea) = ${steelYield.totalLF.toFixed(1)} LF * $${steelYield.costPerLF.toFixed(2)}/LF [${bracketSku}]`);
        
        // 3. FACE PANELS (Universal Bounding Box Agent)
        const yieldW = Agent_Material_Stock.calculateRigidYield(inputs.w, inputs.h, inputs.qty * 2, faceMat);
        const yieldD = Agent_Material_Stock.calculateRigidYield(inputs.d, inputs.h, inputs.qty * 2, faceMat);
        
        const totalSheets = yieldW.sheetsNeeded + yieldD.sheetsNeeded;
        const totalFaceSqFt = yieldW.totalSqFt + yieldD.totalSqFt;
        const totalFaceCost = yieldW.totalCost + yieldD.totalCost;
        const totalDrop = yieldW.dropSqFt + yieldD.dropSqFt;

        addBOM('Metal Fabrication', {
            name: `Skin Panels (${faceMat.description})`,
            pull: `${totalSheets}x ${yieldW.sheetW/12}x${yieldW.sheetH/12} Sheets`,
            cut: `${2 * inputs.qty}x @ ${inputs.w}"x${inputs.h}" & ${2 * inputs.qty}x @ ${inputs.d}"x${inputs.h}"`,
            drop: `${totalDrop.toFixed(1)} SqFt`
        });
        L('METAL_MAT', `Skin Panels (${faceMat.description})`, totalFaceCost, `Yield: ${totalSheets} Sheets * $${yieldW.costPerSheet.toFixed(2)}/Sht [${faceSku}] * ${yieldW.wasteFactor} Waste`);

        // 4. ADHESIVE & MECHANICAL FASTENERS
        const adhesiveLF = ((inputs.w * 4) + (inputs.d * 2) + (inputs.h * 2)) * inputs.qty / 12;
        const cartridges = Math.ceil(adhesiveLF / 10); 
        
        addBOM('Assembly & Hardware', {
            name: `Metal Adhesive (0.25" bead)`,
            pull: `${cartridges} Cartridges`, cut: '--', drop: '--'
        });
        L('METAL_MAT', `Structural Adhesive (3 Sides)`, cartridges * adhesiveCost, `${adhesiveLF.toFixed(1)} LF / 10 LF per tube = ${cartridges} Tubes * $${adhesiveCost.toFixed(2)}/ea ${V('Cost_Adhesive_Tube')}`);

        const spaces = Math.ceil(inputs.h / 7);
        const screwsNeeded = (spaces + 1) * 2 * inputs.qty; 

        addBOM('Assembly & Hardware', {
            name: `Self-Drilling Screws (1" Mod. Truss, 8mm Head)`,
            pull: `${screwsNeeded} Screws`, cut: '--', drop: '--'
        });
        L('INSTALL_HDW', `Mechanical Fasteners`, screwsNeeded * screwCost, `${screwsNeeded} Screws (Spaced ~7" on access panel) * $${screwCost}/ea ${V('Cost_Hardware_Screw_ModTruss')}`);

        L('PAINT_MAT', `Primer Cup (Fasteners)`, paintCupCost, `Small mix to match fastener heads ${V('Cost_Paint_Cup_Small')}`);
        L('PAINT_MAT', `Paint Cup (Fasteners)`, paintCupCost, `Small mix to match fastener heads ${V('Cost_Paint_Cup_Small')}`);

        // 5. METAL LABOR
        const gatherMins = 10;
        addLabor('Metal Fabrication', 'Gather Materials', gatherMins);
        L('METAL_LAB', `Gather Materials`, (gatherMins / 60) * rateShop, `10 Mins * $${rateShop}/hr ${V('Rate_Shop_Labor')}`, { time: gatherMins });

        const shearMins = 5 + (16 * inputs.qty * 1); 
        addLabor('Metal Fabrication', 'Shear Face Panels', shearMins);
        L('METAL_LAB', `Shear Face Panels`, (shearMins / 60) * rateShop, `5 Min Setup + (${16 * inputs.qty} Cuts * 1 Min) * $${rateShop}/hr ${V('Rate_Shop_Labor')}`, { time: shearMins });

        const alumCuts = 16 * inputs.qty;
        const totalCuts = alumCuts + totalBrackets;
        const cutMins = totalCuts * 1; 
        addLabor('Metal Fabrication', 'Saw Cuts', cutMins);
        L('METAL_LAB', `Saw Cuts (Alum & Steel)`, (cutMins / 60) * rateShop, `${totalCuts} cuts @ 1 min/cut * $${rateShop}/hr ${V('Rate_Shop_Labor')}`, { time: cutMins });

        const weldPoints = (12 + 8) * inputs.qty;
        const weldMins = weldPoints * 0.5; 
        addLabor('Metal Fabrication', 'Tack & Bead Welding', weldMins);
        L('METAL_LAB', `Frame Welding`, (weldMins / 60) * rateShop, `${weldPoints} welds @ 0.5 mins * $${rateShop}/hr ${V('Rate_Shop_Labor')}`, { time: weldMins });

        const grindMins = weldPoints * 0.33;
        addLabor('Metal Fabrication', 'Weld Grinding & Cleaning', grindMins);
        L('METAL_LAB', `Weld Grinding & Cleaning`, (grindMins / 60) * rateShop, `${weldPoints} welds @ 0.33 mins * $${rateShop}/hr ${V('Rate_Shop_Labor')}`, { time: grindMins });

        const glueMins = adhesiveLF * (10 / 60);
        addLabor('Metal Fabrication', 'Adhesive Application', glueMins);
        L('METAL_LAB', `Adhesive Application`, (glueMins / 60) * rateShop, `${adhesiveLF.toFixed(1)} LF @ 10 sec/LF * $${rateShop}/hr ${V('Rate_Shop_Labor')}`, { time: glueMins });

        const screwMins = screwsNeeded * (10 / 60);
        addLabor('Metal Fabrication', 'Drill/Tap Access Panel', screwMins);
        L('METAL_LAB', `Drill/Tap Access Panel`, (screwMins / 60) * rateShop, `${screwsNeeded} Screws @ 10 sec/ea * $${rateShop}/hr ${V('Rate_Shop_Labor')}`, { time: screwMins });

        // 6. PAINT LOGIC
        const screwMixMins = 10;
        const screwSprayMins = screwsNeeded * 0.1;
        const screwPaintMins = screwMixMins + screwSprayMins;
        addLabor('Paint & Finishes', 'Mix & Spray Fasteners', screwPaintMins);
        L('PAINT_LAB', `Mix & Spray Fasteners`, (screwPaintMins / 60) * ratePaint, `10 Min Mix + (${screwsNeeded} Screws * 0.1 Min) * $${ratePaint}/hr ${V('Rate_Paint_Labor')}`, { time: screwPaintMins });

        const sqftPerUnit = (((inputs.w * inputs.h) / 144) * 2) + (((inputs.d * inputs.h) / 144) * 2);
        const actualPaintSqFt = sqftPerUnit * inputs.qty;

        if (inputs.paintOption === 'Custom Paint') {
            const paintCostSqFt = num('Cost_Paint_SqFt');
            
            L('PAINT_MAT', `Automotive Primer`, (actualPaintSqFt * (paintCostSqFt * 0.4) * yieldW.wasteFactor) + paintCupCost, `${actualPaintSqFt.toFixed(1)} SF * $${(paintCostSqFt * 0.4).toFixed(2)}/SF ${V('Cost_Paint_SqFt')} * ${yieldW.wasteFactor} Waste + Paint Cup`);
            L('PAINT_MAT', `Automotive Paint (Color)`, (actualPaintSqFt * (paintCostSqFt * 0.6) * yieldW.wasteFactor) + paintCupCost, `${actualPaintSqFt.toFixed(1)} SF * $${(paintCostSqFt * 0.6).toFixed(2)}/SF ${V('Cost_Paint_SqFt')} * ${yieldW.wasteFactor} Waste + Paint Cup`);
            
            addBOM('Paint & Finishes', {
                name: `Automotive Paint/Primer Coverage`,
                pull: `${actualPaintSqFt.toFixed(1)} SF`, cut: '--', drop: '--'
            });

            const paintSetupMins = 15;
            addLabor('Paint & Finishes', 'Paint Mix & Setup', paintSetupMins);
            L('PAINT_LAB', `Paint Mix & Setup`, (paintSetupMins / 60) * ratePaint, `${paintSetupMins} Mins * $${ratePaint}/hr ${V('Rate_Paint_Labor')}`, { time: paintSetupMins });

            const prepMins = actualPaintSqFt * 0.15;
            addLabor('Paint & Finishes', 'Sign Prep & Sanding', prepMins);
            L('PAINT_LAB', `Sign Prep`, (prepMins / 60) * ratePaint, `${actualPaintSqFt.toFixed(1)} SF * 0.15 Mins/SF * $${ratePaint}/hr ${V('Rate_Paint_Labor')}`, { time: prepMins });

            const sprayMins = actualPaintSqFt * 0.40;
            addLabor('Paint & Finishes', 'Spray Primer & Color Coats', sprayMins);
            L('PAINT_LAB', `Spray Application`, (sprayMins / 60) * ratePaint, `${actualPaintSqFt.toFixed(1)} SF * 0.40 Mins/SF * $${ratePaint}/hr ${V('Rate_Paint_Labor')}`, { time: sprayMins });
        }

        // 7. TOTALS & BIDIRECTIONAL MARGIN
        const rawHardCost = cst.reduce((s,i) => s + i.total, 0);
        const finalCost = rawHardCost * risk;
        const unitRetail = finalCost / (1 - targetMargin);

        const specs = {
            product: 'PoleCover',
            qty: inputs.qty, 
            w: inputs.w, 
            h: inputs.h, 
            d: inputs.d,
            poleSize: inputs.poleSize,
            frameMat: inputs.frameMat,
            bracketMat: inputs.bracketMat,
            faceThk: inputs.faceThk,
            paintOption: inputs.paintOption,
            sides: 4, 
            mountStyle: `Pole Cover (${inputs.poleSize}" OD Pole)`,
            postMetalName: 'Steel Brackets / On-Site Weld',
            frameDepth: inputs.d, 
            isAngle: true,
            graphicType: inputs.paintOption, 
            faceKey: faceMat.description
        };

        const payload = {
            retail: { unitPrice: unitRetail, grandTotal: unitRetail * inputs.qty },
            cost: { total: finalCost, breakdown: cst },
            build: { bom: bomMap, routing: routingMap, specs: specs },
            metrics: { margin: targetMargin, sqft: sqftPerUnit }
        };

        if (auditMode === 'retail_only') payload.cost.breakdown = [];
        return new Response(JSON.stringify(payload), { headers: corsHeaders, status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 });
    }
});