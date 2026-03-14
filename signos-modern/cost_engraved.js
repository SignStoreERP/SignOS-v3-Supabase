/**
 * PURE PHYSICS ENGINE: ADA Quoter (v3.8)
 * Fully Stabilized - Prevents ReferenceErrors and Engine Crashes.
 */
function calculateEngraved(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;
    
    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const C = (k, val) => {
        let desc = "";
        if (window.ENGRAVED_CONFIG && window.ENGRAVED_CONFIG.constants) {
            let match = window.ENGRAVED_CONFIG.constants.find(x => x.key === k);
            if (match) desc = match.desc;
        }
        return `<span class="hover-var text-emerald-600 border-b border-dotted border-emerald-400 cursor-help transition-all font-bold" data-var="${k}" title="${desc}">${val}</span>`;
    };

    const ret = [];
    const cst = [];
    
    // Ensure unit is strictly mapped so the HTML Subline builder doesn't crash
    const R = (label, total, formula) => { if(total !== 0) ret.push({label, total, unit: total / inputs.qty, formula}); return total; };
    const L = (label, total, formula) => { if(total !== 0) cst.push({label, total, unit: total / inputs.qty, formula}); return total; };

    // 1. SAFELY DECLARE ALL GLOBAL RATES ONCE
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);
    const engraveRate = parseFloat(data.Rate_Machine_Engraver || 10);
    const cncRate = parseFloat(data.Rate_Machine_CNC || 10);
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    // --- MATERIAL DICTIONARY ---
    const sheet1152 = 1152;
    const sheet4608 = 4608;
    const matDict = {
        '1/32': { cost: parseFloat(data.Cost_Sub_Tactile || 55), yield: sheet1152, name: '1/32" Tactile', costKey: 'Cost_Sub_Tactile' },
        '1/16': { cost: parseFloat(data.Cost_Sub_ADA_Core_116 || 50), yield: sheet1152, name: '1/16" Core', costKey: 'Cost_Sub_ADA_Core_116' },
        '1/8': { cost: parseFloat(data.Cost_Sub_ADA_Core_18 || 70), yield: sheet1152, name: '1/8" Core', costKey: 'Cost_Sub_ADA_Core_18' },
        '3mm': { cost: parseFloat(data.Cost_Sub_PVC || 29.09), yield: sheet4608, name: '3mm PVC Backer', costKey: 'Cost_Sub_PVC' },
        '3/16': { cost: parseFloat(data.Cost_Sub_Acrylic || 91.65), yield: sheet4608, name: '3/16" Clear Acrylic', costKey: 'Cost_Sub_Acrylic' },
        '1/32_CLR': { cost: parseFloat(data.ADA_APP_132_CLR || 58.12), yield: sheet1152, name: '1/32" Clear Lens', costKey: 'ADA_APP_132_CLR' }
    };

    // --- LAYER ANALYSIS ---
    let hasCNC = false;
    let hasPaperWindow = inputs.addons ? inputs.addons.some(a => a.type === 'Window_Paper') : false;
    let hasEngravedWindow = inputs.addons ? inputs.addons.some(a => a.type === 'Window_Engraved') : false;
    let solidLayers = 0;
    let tactileLayers = 0;

    let safeLayers = inputs.layers || [];
    if(safeLayers.length > 0) {
        safeLayers.forEach(l => {
            if (matDict[l.type]) {
                let m = matDict[l.type];
                let yieldKey = m.yield === 1152 ? 'C_1152' : 'C_4608';
                L(`${m.name} (${l.colorName || 'Base'})`, (totalSqin * (m.cost / m.yield)) * wastePct, `(Total SqIn * ${V(m.costKey)} / ${C(yieldKey, m.yield)}) * ${V('Waste_Factor')}`);
                if (l.type === '3mm' || l.type === '3/16') hasCNC = true;
                if (l.type === '1/32') tactileLayers++;
                else if (l.type !== '1/32_CLR') solidLayers++;
            }
        });
    }
    
    if (hasPaperWindow || hasEngravedWindow) hasCNC = true;
    let tapeLayers = Math.max(0, solidLayers - 1);
    if (inputs.mounting === 'Foam Tape') tapeLayers++;

    // --- LABOR & MACHINE RUNS ---
    L(`File Preflight`, (parseFloat(data.Time_Preflight_Job || 15) / 60) * rateOp, `${V('Time_Preflight_Job')} Mins * ${V('Rate_Operator')}`);
    L(`Engraver Handling/Load`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * rateOp, `Qty * ${V('Time_Engraver_Load_Per_Item')} Mins * ${V('Rate_Operator')}`);
    L(`Engraver Machine Run`, ((totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.25)) / 60) * engraveRate, `Total SqIn * ${V('Time_Engrave_SqIn')} Mins * ${V('Rate_Machine_Engraver')}`);

    // --- BRAILLE MATH (FIXED: Safely Declared) ---
    let totalBeads = tactileLayers > 0 ? (inputs.qty * 10) : 0;
    if (totalBeads > 0) {
        L(`Braille Beads`, totalBeads * parseFloat(data.Cost_Raster_Bead || 0.01) * wastePct, `10 Beads/Sign * ${V('Cost_Raster_Bead')} * ${V('Waste_Factor')}`);
        L(`Braille Insertion`, (totalBeads * 0.05 / 60) * shopRate, `Total Beads * ${C('C_005', '0.05 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    // --- WINDOW ADD-ONS ---
    if (hasPaperWindow) {
        let lensMat = matDict['1/32_CLR'];
        L(`Paper Lens Material (1/32" Clear)`, (totalSqin * (lensMat.cost / lensMat.yield)) * wastePct, `Full Size Lens * ${V('Waste_Factor')}`);
    }
    if (hasEngravedWindow) {
        let sh = 2;
        if (inputs.addons) {
            let match = inputs.addons.find(a => a.type === 'Window_Engraved');
            if (match && match.sliderH) sh = parseFloat(match.sliderH);
        }
        let sliderSqin = inputs.w * sh * inputs.qty;
        let slMat = matDict['1/16'];
        L(`Slider Substrate (1/16" Core)`, (sliderSqin * (slMat.cost / slMat.yield)) * wastePct, `Slider SqIn * ${V('Cost_Sub_ADA_Core_116')} / ${C('C_1152', '1152')}`);
        L(`Slider Paint Fill Material`, sliderSqin * parseFloat(data.Cost_Paint_SqIn || 0.01) * wastePct, `Slider SqIn * ${V('Cost_Paint_SqIn')} * ${V('Waste_Factor')}`);
    }

    // --- CNC & ASSEMBLY ---
    if (hasCNC) {
        L(`CNC Router Run`, ((totalSqin * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144) / 60) * cncRate, `(Total SqFt * ${V('Time_CNC_Easy_SqFt')}) Mins * ${V('Rate_Machine_CNC')}`);
        L(`CNC Operator`, ((totalSqin * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144) / 60) * rateOp, `(Total SqFt * ${V('Time_CNC_Easy_SqFt')}) Mins * ${V('Rate_Operator')}`);
    }

    if (tapeLayers > 0) {
        const tapeCostLF = parseFloat(data.Cost_Hem_Tape || 0.08);
        L(`Assembly Tape (${tapeLayers} Layers)`, ((totalSqin / 144) * tapeCostLF * tapeLayers) * wastePct, `(SqFt * ${V('Cost_Hem_Tape')}) * ${tapeLayers} Layers * ${V('Waste_Factor')}`);
        L(`Assembly Labor`, (inputs.qty * tapeLayers * 2 / 60) * shopRate, `Qty * ${tapeLayers} Layers * ${C('C_2', '2 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    // --- RETAIL MARKET VALUE ---
    let baseRetailSqIn = parseFloat(data.Retail_Price_ADA_Basic_AB || 1.60);
    if (inputs.product === 'BasicClear') baseRetailSqIn = parseFloat(data.Retail_Price_ADA_Basic_Clear || 1.80);

    R('Base ADA Sign', totalSqin * baseRetailSqIn, `Total SqIn * $${baseRetailSqIn.toFixed(2)}`);

    let forcedBacker = false;
    if (hasPaperWindow || hasEngravedWindow) {
        let hasBacker = safeLayers.some(l => l.type === '3mm' || l.type === '3/16');
        if (!hasBacker) forcedBacker = true;
        R(`Routed Window Pocket`, totalSqin * 0.40, `Total SqIn * $0.40`);
    }

    if(inputs.addons) {
        inputs.addons.forEach(a => {
            if (a.type !== 'Window_Paper' && a.type !== 'Window_Engraved') {
                R(`Extra Layer (${a.type})`, totalSqin * 0.35, `Total SqIn * $0.35`);
            }
        });
    }

    if (forcedBacker) {
        R(`Forced 3mm PVC Backer`, totalSqin * 0.40, `Total SqIn * $0.40 (Structural Requirement)`);
    }

    // --- TOTALS ---
    let hardCost = cst.reduce((sum, i) => sum + i.total, 0);
    let rawRetail = ret.reduce((sum, i) => sum + i.total, 0);

    let minOrder = parseFloat(data.Retail_Min_Order || 50);
    if(!data.Retail_Min_Order && data.Retail_Min_Order_Etch) minOrder = parseFloat(data.Retail_Min_Order_Etch);

    let isMinApplied = false;
    let grandTotal = rawRetail;

    if (rawRetail < minOrder) {
        isMinApplied = true;
        R('Shop Minimum Surcharge', minOrder - rawRetail, `Minimum order difference`);
        grandTotal = minOrder;
    }

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret, isMinApplied: isMinApplied, forcedBacker: forcedBacker },
        cost: { total: hardCost * riskFactor, breakdown: cst },
        metrics: { margin: (grandTotal - (hardCost * riskFactor)) / grandTotal }
    };
}

window.ENGRAVED_CONFIG = {
    tab: 'PROD_ADA_Signs',
    engine: calculateEngraved,
    controls: [
        { id: 'w', label: 'Width', type: 'number', def: 8 },
        { id: 'h', label: 'Height', type: 'number', def: 8 }
    ],
    retails: [
        { key: 'Retail_Price_ADA_Basic_AB', label: 'Basic ADA ($/Sqin)' },
        { key: 'Retail_Price_ADA_Basic_Clear', label: 'Acr ADA ($/Sqin)' },
        { key: 'Retail_Price_Window_Paper', label: 'Paper Window ($/Sqin)' },
        { key: 'Retail_Price_Window_Engraved', label: 'Engraved Slider ($/Sqin)' },
        { key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
        { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' }
    ],
    costs: [
        { key: 'Cost_Sub_ADA_Core_116', label: '1/16" Core ($/Sht)' },
        { key: 'Cost_Sub_ADA_Core_18', label: '1/8" Core ($/Sht)' },
        { key: 'Cost_Sub_Tactile', label: '1/32" Tactile ($/Sht)' },
        { key: 'Cost_Sub_PVC', label: '3mm PVC ($/Sht)' },
        { key: 'Cost_Sub_Acrylic', label: '3/16" Clear ($/Sht)' },
        { key: 'ADA_APP_132_CLR', label: '1/32" Clear Lens ($/Sht)' },
        { key: 'Cost_Raster_Bead', label: 'Raster Bead ($/Ea)' },
        { key: 'Cost_Paint_SqIn', label: 'Paint ($/SqIn)' },
        { key: 'Cost_Hem_Tape', label: 'Tape ($/Roll)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'CNC Mach ($/Hr)' },
        { key: 'Time_Preflight_Job', label: 'File Preflight (Mins)' },
        { key: 'Time_Engraver_Load_Per_Item', label: 'Load Item (Mins)' },
        { key: 'Time_Engrave_SqIn', label: 'Engrave (Mins/Sqin)' },
        { key: 'Time_Paint_Setup', label: 'Paint Setup (Mins)' },
        { key: 'Time_Paint_SqIn', label: 'Paint (Mins/Sqin)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC Time (Mins/SqFt)' },
        { key: 'Waste_Factor', label: 'Waste Factor' },
        { key: 'Factor_Risk', label: 'Risk Factor' }
    ],
    constants: [
        { key: 'C_1152', val: '1152', label: '1152 (ADA Sheet)', desc: 'SqIn yield of a 24" x 48" half-sheet.' },
        { key: 'C_4608', val: '4608', label: '4608 (Full Sheet)', desc: 'SqIn yield of a full 4\' x 8\' sheet.' },
        { key: 'C_144', val: '144', label: '144 (SqFt Base)', desc: 'SqIn per SqFt.' },
        { key: 'C_005', val: '0.05', label: '0.05 Mins', desc: 'Estimated shop labor time to manually insert a single Raster Braille Bead.' },
        { key: 'C_2', val: '2', label: '2 Mins', desc: 'Estimated shop labor time to align, tape, and press a single material layer.' }
    ]
};