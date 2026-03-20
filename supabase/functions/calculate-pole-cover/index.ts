declare const Deno: any;
import { Agent_Material_Stock } from "../_shared/agents/Agent_Material_Stock.ts";
import { Agent_Labor_Ops } from "../_shared/agents/Agent_Labor_Ops.ts";

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

        const num = (k: string, fb: number) => { const p = parseFloat(config[k]); return isNaN(p) ? fb : p; };
        const V = (k: string) => `<span class="text-blue-600 font-bold">[${k}]</span>`;

        const risk = num('Factor_Risk', 1.05);
        const targetMargin = num('Target_Margin_Pct', 0.60);

        // --- UNIVERSAL AGENT DATA FETCH (No Fallback Mandate) ---
        const faceSku = inputs.faceSku || 'ALM_SHT_040';
        const frameSku = inputs.frameSku || 'ALM_ANG_1.5';
        const bracketSku = inputs.bracketSku || 'STL_ANG_1.5_18';

        // 1. Retrieve Material Physics profiles natively
        const faceMat = await Agent_Material_Stock.fetchMaterial(faceSku, authHeader);
        const frameMat = await Agent_Material_Stock.fetchMaterial(frameSku, authHeader);
        const bracketMat = await Agent_Material_Stock.fetchMaterial(bracketSku, authHeader);
        const adhesiveMat = await Agent_Material_Stock.fetchMaterial('HDW_ADH_LORD_TUBE', authHeader);
        const screwMat = await Agent_Material_Stock.fetchMaterial('HDW_SCREW_MOD_TRUSS', authHeader);
        const paintCupMat = await Agent_Material_Stock.fetchMaterial('PNT_CUP_SML', authHeader);
        const primerMat = await Agent_Material_Stock.fetchMaterial('PNT_AUTO_PRIMER', authHeader);
        const colorMat = await Agent_Material_Stock.fetchMaterial('PNT_AUTO_COLOR', authHeader);

        // 2. Retrieve Labor Operation profiles natively
        const shopLabor = await Agent_Labor_Ops.fetchLaborRate('LAB_OP', authHeader).catch(() => ({ costRateHr: 150 }));
        const paintLabor = await Agent_Labor_Ops.fetchLaborRate('LAB_OP', authHeader).catch(() => ({ costRateHr: 150 }));
        
        const rateShop = shopLabor.costRateHr;
        const ratePaint = paintLabor.costRateHr;

        const adhesiveCost = adhesiveMat.internal_cost;
        const screwCost = screwMat.internal_cost;
        const paintCupCost = paintCupMat.internal_cost;

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
        const L = (category: string, label: string, total: number, formula: string) => { if (total > 0) cst.push({label, total, formula, category}); return total; };

        // =====================================
        // 1. FRAME & BRACING MATH
        // =====================================
        const frameLF_per = ((inputs.w * 4) + (inputs.d * 4) + (inputs.h * 4)) / 12;
        const frameYield = Agent_Material_Stock.calculateLinearYield(frameLF_per * 12, inputs.qty, frameMat, 24);

        addBOM('Metal Fabrication', {
            name: `Aluminum Skeleton Frame (${frameMat.description})`,
            pull: `${frameYield.sticksNeeded}x 24' Sticks (${frameYield.sticksNeeded * 24} LF)`,
            cut: `${4 * inputs.qty}x @ ${inputs.w}", ${4 * inputs.qty}x @ ${inputs.h}", ${8 * inputs.qty}x @ ${inputs.d}" (Frame & Braces)`,
            drop: `${frameYield.dropLF.toFixed(1)} LF`
        });
        L('METAL_MAT', `Aluminum Structure (${frameMat.description})`, frameYield.totalCost, `${frameYield.totalLF.toFixed(1)} LF * $${frameYield.costPerLF.toFixed(2)}/LF [${frameSku}] * ${frameYield.wasteFactor} Waste`);

        // =====================================
        // 2. BRACKETS MATH (Steel)
        // =====================================
        const bracketLF_per = (inputs.h * 2) / 12; 
        const bracketYield = Agent_Material_Stock.calculateLinearYield(bracketLF_per * 12, inputs.qty, bracketMat, 20);

        addBOM('Metal Fabrication', {
            name: `Welded Steel Brackets (${bracketMat.description})`,
            pull: `${bracketYield.sticksNeeded}x 20' Sticks (${bracketYield.sticksNeeded * 20} LF)`,
            cut: `${2 * inputs.qty}x @ ${inputs.h}"`,
            drop: `${bracketYield.dropLF.toFixed(1)} LF`
        });
        L('METAL_MAT', `Steel Brackets (${bracketMat.description})`, bracketYield.totalCost, `${bracketYield.totalLF.toFixed(1)} LF * $${bracketYield.costPerLF.toFixed(2)}/LF [${bracketSku}] * ${bracketYield.wasteFactor} Waste`);

        // =====================================
        // 3. FACE SUBSTRATES (Skin)
        // =====================================
        // Using twin bounding boxes for the 4 faces (W faces vs D faces)
        const yieldW = Agent_Material_Stock.calculateSheetYield(inputs.w, inputs.h, inputs.qty * 2, faceMat, 48, 120);
        const yieldD = Agent_Material_Stock.calculateSheetYield(inputs.d, inputs.h, inputs.qty * 2, faceMat, 48, 120);

        const totalSheets = yieldW.sheetsNeeded + yieldD.sheetsNeeded;
        const totalFaceCost = yieldW.totalCost + yieldD.totalCost;

        addBOM('Metal Fabrication', {
            name: `Skin Panels (${faceMat.description})`,
            pull: `${totalSheets}x ${yieldW.sheetW/12}x${yieldW.sheetH/12} Sheets`,
            cut: `${2 * inputs.qty}x @ ${inputs.w}"x${inputs.h}" & ${2 * inputs.qty}x @ ${inputs.d}"x${inputs.h}"`,
            drop: `${(yieldW.dropSqFt + yieldD.dropSqFt).toFixed(1)} SF`
        });
        L('METAL_MAT', `Skin Panels (${faceMat.description})`, totalFaceCost, `${totalSheets} Sheets * $${faceMat.internal_cost.toFixed(2)}/Sht [${faceSku}] * ${faceMat.waste_factor} Waste`);

        // =====================================
        // 4. ASSEMBLY & HARDWARE
        // =====================================
        const adhesiveLF = ((inputs.w * 2) + (inputs.d * 2) + (inputs.h * 4)) / 12 * inputs.qty;
        const cartridges = Math.ceil(adhesiveLF / 10);
        
        addBOM('Assembly & Hardware', {
            name: `Structural Adhesive (0.25" bead)`,
            pull: `${cartridges} Cartridges`, cut: '--', drop: '--'
        });
        L('METAL_MAT', `Structural Adhesive (3 Sides)`, cartridges * adhesiveCost, `${adhesiveLF.toFixed(1)} LF / 10 LF per tube = ${cartridges} Tubes * $${adhesiveCost.toFixed(2)}/ea [HDW_ADH_LORD_TUBE]`);

        const spaces = Math.ceil(inputs.h / 7);
        const screwsNeeded = (spaces + 1) * 2 * inputs.qty;
        addBOM('Assembly & Hardware', {
            name: `Self-Drilling Screws (${screwMat.description})`,
            pull: `${screwsNeeded} Screws`, cut: '--', drop: '--'
        });
        L('INSTALL_HDW', `Mechanical Fasteners`, screwsNeeded * screwCost, `${screwsNeeded} Screws (Spaced ~7" on access panel) * $${screwCost.toFixed(2)}/ea [HDW_SCREW_MOD_TRUSS]`);
        L('PAINT_MAT', `Primer Cup (Fasteners)`, paintCupCost, `Small mix to match fastener heads [PNT_CUP_SML]`);
        L('PAINT_MAT', `Paint Cup (Fasteners)`, paintCupCost, `Small mix to match fastener heads [PNT_CUP_SML]`);

        // =====================================
        // 5. METAL FABRICATION LABOR
        // =====================================
        const gatherMins = 10;
        addLabor('Metal Fabrication', 'Gather Materials', gatherMins);
        L('METAL_LAB', `Gather Materials`, (gatherMins / 60) * rateShop, `10 Mins * $${rateShop}/hr`);

        const shearMins = 5 + (16 * inputs.qty * 1);
        addLabor('Metal Fabrication', 'Shear Face Panels', shearMins);
        L('METAL_LAB', `Shear Face Panels`, (shearMins / 60) * rateShop, `5 Min Setup + (${16 * inputs.qty} Cuts * 1 Min) * $${rateShop}/hr`);

        const totalBrackets = 2 * inputs.qty;
        const alumCuts = 16 * inputs.qty;
        const totalCuts = alumCuts + totalBrackets;
        const cutMins = totalCuts * 1;
        addLabor('Metal Fabrication', 'Saw Cuts', cutMins);
        L('METAL_LAB', `Saw Cuts (Alum & Steel)`, (cutMins / 60) * rateShop, `${totalCuts} cuts @ 1 min/cut * $${rateShop}/hr`);

        const weldPoints = (12 + 8) * inputs.qty;
        const weldMins = weldPoints * 0.5;
        addLabor('Metal Fabrication', 'Tack & Bead Welding', weldMins);
        L('METAL_LAB', `Frame Welding`, (weldMins / 60) * rateShop, `${weldPoints} welds @ 0.5 mins * $${rateShop}/hr`);

        const grindMins = weldPoints * 0.33;
        addLabor('Metal Fabrication', 'Weld Grinding & Cleaning', grindMins);
        L('METAL_LAB', `Weld Grinding & Cleaning`, (grindMins / 60) * rateShop, `${weldPoints} welds @ 0.33 mins * $${rateShop}/hr`);

        const glueMins = adhesiveLF * (10 / 60);
        addLabor('Metal Fabrication', 'Adhesive Application', glueMins);
        L('METAL_LAB', `Adhesive Application`, (glueMins / 60) * rateShop, `${adhesiveLF.toFixed(1)} LF @ 10 sec/LF * $${rateShop}/hr`);

        const screwMins = screwsNeeded * (10 / 60);
        addLabor('Metal Fabrication', 'Drill/Tap Access Panel', screwMins);
        L('METAL_LAB', `Drill/Tap Access Panel`, (screwMins / 60) * rateShop, `${screwsNeeded} Screws @ 10 sec/ea * $${rateShop}/hr`);

        // =====================================
        // 6. PAINT LOGIC
        // =====================================
        const screwMixMins = 10;
        const screwSprayMins = screwsNeeded * 0.1;
        const screwPaintMins = screwMixMins + screwSprayMins;
        addLabor('Paint & Finishes', 'Mix & Spray Fasteners', screwPaintMins);
        L('PAINT_LAB', `Mix & Spray Fasteners`, (screwPaintMins / 60) * ratePaint, `10 Min Mix + (${screwsNeeded} Screws * 0.1 Min) * $${ratePaint}/hr`);

        const sqftPerUnit = (((inputs.w * inputs.h) / 144) * 2) + (((inputs.d * inputs.h) / 144) * 2);
        
        if (inputs.paintOption === 'Custom Paint') {
            const actualPaintSqFt = sqftPerUnit * inputs.qty;
            const sqftPerGal = 300;
            const primerCostSqFt = primerMat.internal_cost / sqftPerGal;
            const colorCostSqFt = colorMat.internal_cost / sqftPerGal;

            L('PAINT_MAT', `Automotive Primer`, actualPaintSqFt * primerCostSqFt, `${actualPaintSqFt.toFixed(1)} SF * $${primerCostSqFt.toFixed(2)}/SF [PNT_AUTO_PRIMER]`);
            L('PAINT_MAT', `Automotive Color Paint`, actualPaintSqFt * colorCostSqFt, `${actualPaintSqFt.toFixed(1)} SF * $${colorCostSqFt.toFixed(2)}/SF [PNT_AUTO_COLOR]`);

            addBOM('Paint & Finishes', {
                name: `Automotive Paint/Primer Coverage`,
                pull: `${actualPaintSqFt.toFixed(1)} SF`, cut: '--', drop: '--'
            });

            const paintSetupMins = 15;
            addLabor('Paint & Finishes', 'Paint Mix & Setup', paintSetupMins);
            L('PAINT_LAB', `Paint Mix & Setup`, (paintSetupMins / 60) * ratePaint, `${paintSetupMins} Mins * $${ratePaint}/hr`);

            const prepMins = actualPaintSqFt * 0.15;
            addLabor('Paint & Finishes', 'Sign Prep & Sanding', prepMins);
            L('PAINT_LAB', `Sign Prep`, (prepMins / 60) * ratePaint, `${actualPaintSqFt.toFixed(1)} SF * 0.15 Mins/SF * $${ratePaint}/hr`);

            const sprayMins = actualPaintSqFt * 0.40;
            addLabor('Paint & Finishes', 'Spray Primer & Color Coats', sprayMins);
            L('PAINT_LAB', `Spray Application`, (sprayMins / 60) * ratePaint, `${actualPaintSqFt.toFixed(1)} SF * 0.40 Mins/SF * $${ratePaint}/hr`);
        }

        // =====================================
        // 7. TOTALS & BIDIRECTIONAL MARGIN
        // =====================================
        const rawHardCost = cst.reduce((s, i) => s + i.total, 0);
        const finalCost = rawHardCost * risk;
        const unitRetail = finalCost / (1 - targetMargin);
        const totalRetail = unitRetail;

        R(`Custom Pole Cover Assembly`, totalRetail, `Hard Cost * ${risk.toFixed(2)} Risk Buffer / (1 - ${targetMargin.toFixed(2)} Margin)`);

        const specs = {
            product: 'PoleCover',
            qty: inputs.qty,
            w: inputs.w,
            h: inputs.h,
            d: inputs.d,
            faceMat: faceMat.description,
            frameMat: frameMat.description,
            bracketMat: bracketMat.description,
            paint: inputs.paintOption
        };

        const payload = {
            retail: { unitPrice: unitRetail / inputs.qty, grandTotal: totalRetail, breakdown: ret },
            cost: { total: finalCost, breakdown: cst },
            build: { bom: bomMap, routing: routingMap, specs: specs },
            metrics: { margin: targetMargin, sqft: sqftPerUnit }
        };

        if (auditMode === 'retail_only') payload.cost.breakdown = [];

        return new Response(JSON.stringify(payload), { headers: corsHeaders, status: 200 });

    } catch (err: any) {
        console.error("Agent Engine Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 });
    }
});