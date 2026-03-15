const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { inputs, config } = await req.json()

    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    const getDesc = (k: string) => config['META_NOTE_' + k] || "System parameter.";
    
    // NEW: Exposes both the variable name AND the actual injected value in the equation
    const V = (k: string) => {
      let val = config[k] !== undefined ? config[k] : 'N/A';
      if (!isNaN(parseFloat(val))) val = parseFloat(val).toFixed(2);
      return `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}: ${val}]</span>`;
    };
    
    const C = (k: string, val: string) => `<span class="hover-var text-emerald-600 border-b border-dotted border-emerald-400 cursor-help transition-all font-bold" data-var="${k}">${val}</span>`;

    const ret: any[] = []; const cst: any[] = [];

    const R = (label: string, total: number, formula: string) => { if(total !== 0) ret.push({label, total, unit: total / inputs.qty, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total !== 0) cst.push({label, total, unit: total / inputs.qty, formula}); return total; };

    const rateOp = parseFloat(config.Rate_Operator || "25");
    const shopRate = parseFloat(config.Rate_Shop_Labor || "20");
    const engraveRate = parseFloat(config.Rate_Machine_Engraver || "10");
    const cncRate = parseFloat(config.Rate_Machine_CNC || "10");
    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    const riskFactor = parseFloat(config.Factor_Risk || "1.05");

    const sheet1152 = 1152;
    const sheet4608 = 4608;

    const matDict: any = {
      '1/32': { cost: parseFloat(config.Cost_Sub_Tactile || "55"), yield: sheet1152, name: '1/32" Tactile', costKey: 'Cost_Sub_Tactile' },
      '1/16': { cost: parseFloat(config.Cost_Sub_ADA_Core_116 || "50"), yield: sheet1152, name: '1/16" Core', costKey: 'Cost_Sub_ADA_Core_116' },
      '1/8': { cost: parseFloat(config.Cost_Sub_ADA_Core_18 || "70"), yield: sheet1152, name: '1/8" Core', costKey: 'Cost_Sub_ADA_Core_18' },
      '3mm': { cost: parseFloat(config.Cost_Sub_PVC || "29.09"), yield: sheet4608, name: '3mm PVC Backer', costKey: 'Cost_Sub_PVC' },
      '3/16': { cost: parseFloat(config.Cost_Sub_Acrylic || "91.65"), yield: sheet4608, name: '3/16" Clear Acrylic', costKey: 'Cost_Sub_Acrylic' },
      '1/32_CLR': { cost: parseFloat(config.ADA_APP_132_CLR || "58.12"), yield: sheet1152, name: '1/32" Clear Lens', costKey: 'ADA_APP_132_CLR' }
    };

    let hasCNC = false;
    let hasPaperWindow = inputs.addons ? inputs.addons.some((a: any) => a.type === 'Window_Paper') : false;
    let hasEngravedWindow = inputs.addons ? inputs.addons.some((a: any) => a.type === 'Window_Engraved') : false;

    let solidLayers = 0;
    let tactileLayers = 0;

    let safeLayers = inputs.layers || [];

    if(safeLayers.length > 0) {
      safeLayers.forEach((l: any) => {
        if (matDict[l.type]) {
          let m = matDict[l.type];
          let yieldKey = m.yield === 1152 ? 'C_1152' : 'C_4608';
          L(`${m.name} (${l.colorName || 'Base'})`, (totalSqin * (m.cost / m.yield)) * wastePct, `(Total SqIn * ${V(m.costKey)} / ${C(yieldKey, String(m.yield))}) * ${V('Waste_Factor')}`);

          if (l.type === '3mm' || l.type === '3/16') hasCNC = true;
          if (l.type === '1/32') tactileLayers++;
          else if (l.type !== '1/32_CLR') solidLayers++;
        }
      });
    }

    if (hasPaperWindow || hasEngravedWindow) hasCNC = true;

    let tapeLayers = Math.max(0, solidLayers - 1);
    if (inputs.mounting === 'Foam Tape') tapeLayers++;

    // === FIXED: MISSING ENGRAVER LABOR & MACHINE RUNS RESTORED ===
    L(`File Preflight`, (parseFloat(config.Time_Preflight_Job || "15") / 60) * rateOp, `${V('Time_Preflight_Job')} Mins * ${V('Rate_Operator')}`);
    L(`Engraver Handling/Load`, (parseFloat(config.Time_Engraver_Load_Per_Item || "2") * inputs.qty / 60) * rateOp, `Qty * ${V('Time_Engraver_Load_Per_Item')} Mins * ${V('Rate_Operator')}`);
    L(`Engraver Machine Run`, ((totalSqin * parseFloat(config.Time_Engrave_SqIn || "0.25")) / 60) * engraveRate, `Total SqIn * ${V('Time_Engrave_SqIn')} Mins * ${V('Rate_Machine_Engraver')}`);
    // =============================================================

    let totalBeads = tactileLayers > 0 ? (inputs.qty * 10) : 0;
    if (totalBeads > 0) {
      L(`Braille Beads`, totalBeads * parseFloat(config.Cost_Raster_Bead || "0.01") * wastePct, `10 Beads/Sign * ${V('Cost_Raster_Bead')} * ${V('Waste_Factor')}`);
      L(`Braille Insertion`, (totalBeads * 0.05 / 60) * shopRate, `Total Beads * ${C('C_005', '0.05 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    if (hasPaperWindow) {
      let lensMat = matDict['1/32_CLR'];
      L(`Paper Lens Material (1/32" Clear)`, (totalSqin * (lensMat.cost / lensMat.yield)) * wastePct, `Full Size Lens * ${V('Waste_Factor')}`);
    }

    if (hasEngravedWindow) {
      let sh = 2;
      if (inputs.addons) {
        let match = inputs.addons.find((a: any) => a.type === 'Window_Engraved');
        if (match && match.sliderH) sh = parseFloat(match.sliderH);
      }
      let sliderSqin = inputs.w * sh * inputs.qty;
      let slMat = matDict['1/16'];
      L(`Slider Substrate (1/16" Core)`, (sliderSqin * (slMat.cost / slMat.yield)) * wastePct, `Slider SqIn * ${V('Cost_Sub_ADA_Core_116')} / ${C('C_1152', '1152')}`);
      L(`Slider Paint Fill Material`, sliderSqin * parseFloat(config.Cost_Paint_SqIn || "0.01") * wastePct, `Slider SqIn * ${V('Cost_Paint_SqIn')} * ${V('Waste_Factor')}`);
    }

    if (hasCNC) {
      L(`CNC Router Run`, ((totalSqin * parseFloat(config.Time_CNC_Easy_SqFt || "1") / 144) / 60) * cncRate, `(Total SqFt * ${V('Time_CNC_Easy_SqFt')}) Mins * ${V('Rate_Machine_CNC')}`);
      L(`CNC Operator`, ((totalSqin * parseFloat(config.Time_CNC_Easy_SqFt || "1") / 144) / 60) * rateOp, `(Total SqFt * ${V('Time_CNC_Easy_SqFt')}) Mins * ${V('Rate_Operator')}`);
    }

    if (tapeLayers > 0) {
      const tapeCostLF = parseFloat(config.Cost_Hem_Tape || "0.08");
      L(`Assembly Tape (${tapeLayers} Layers)`, ((totalSqin / 144) * tapeCostLF * tapeLayers) * wastePct, `(SqFt * ${V('Cost_Hem_Tape')}) * ${tapeLayers} Layers * ${V('Waste_Factor')}`);
      L(`Assembly Labor`, (inputs.qty * tapeLayers * 2 / 60) * shopRate, `Qty * ${tapeLayers} Layers * ${C('C_2', '2 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    let baseRetailSqIn = parseFloat(config.Retail_Price_ADA_Basic_AB || "1.60");
    if (inputs.product === 'BasicClear') baseRetailSqIn = parseFloat(config.Retail_Price_ADA_Basic_Clear || "1.80");

    R('Base ADA Sign', totalSqin * baseRetailSqIn, `Total SqIn * $${baseRetailSqIn.toFixed(2)}`);

    let forcedBacker = false;
    if (hasPaperWindow || hasEngravedWindow) {
      let hasBacker = safeLayers.some((l: any) => l.type === '3mm' || l.type === '3/16');
      if (!hasBacker) forcedBacker = true;
      R(`Routed Window Pocket`, totalSqin * 0.40, `Total SqIn * $0.40`);
    }

    if(inputs.addons) {
      inputs.addons.forEach((a: any) => {
        if (a.type !== 'Window_Paper' && a.type !== 'Window_Engraved') {
          R(`Extra Layer (${a.type})`, totalSqin * 0.35, `Total SqIn * $0.35`);
        }
      });
    }

    if (forcedBacker) {
      R(`Forced 3mm PVC Backer`, totalSqin * 0.40, `Total SqIn * $0.40 (Structural Requirement)`);
    }

    let hardCost = cst.reduce((sum, i) => sum + i.total, 0);
    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);

    const minOrder = parseFloat(config.Retail_Min_Order || "50");
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    const isMinApplied = grandTotalRaw < minOrder;

    if (isMinApplied) R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `${V('Retail_Min_Order')} - Subtotal`);

    const payload = {
      retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied, forcedBacker },
      cost: { total: hardCost * riskFactor, breakdown: cst },
      metrics: { margin: (grandTotal - (hardCost * riskFactor)) / grandTotal }
    };

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})