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

    const ret: any[] = []; const cst: any[] = [];
    const R = (label: string, total: number, formula: string) => { if(total !== 0 && !isNaN(total)) ret.push({label, total, unit: total / inputs.qty, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if(total !== 0 && !isNaN(total)) cst.push({label, total, unit: total / inputs.qty, formula}); return total; };

    // Extracts the variable value and wraps it cleanly for the UI
    const num = (val: any, fallback: string) => { const p = parseFloat(val); return isNaN(p) ? parseFloat(fallback) : p; };
    const V = (k: string, fb: string) => `<span class="text-blue-600 font-bold" title="${k}">[${k}: ${num(config[k], fb)}]</span>`;

    const rateOp = num(config.Rate_Operator, "25");
    const shopRate = num(config.Rate_Shop_Labor, "20");
    const engraveRate = num(config.Rate_Machine_Engraver, "10");
    const cncRate = num(config.Rate_Machine_CNC, "10");
    const wastePct = num(config.Waste_Factor, "1.15");
    const riskFactor = num(config.Factor_Risk, "1.05");

    const matDict: any = {
      '1/32': { cost: num(config.Cost_Sub_Tactile, "55"), yield: 1152, name: '1/32" Tactile', costKey: 'Cost_Sub_Tactile' },
      '1/16': { cost: num(config.Cost_Sub_ADA_Core_116, "50"), yield: 1152, name: '1/16" Core', costKey: 'Cost_Sub_ADA_Core_116' },
      '1/8': { cost: num(config.Cost_Sub_ADA_Core_18, "70"), yield: 1152, name: '1/8" Core', costKey: 'Cost_Sub_ADA_Core_18' },
      '3mm': { cost: num(config.Cost_Sub_PVC, "29.09"), yield: 4608, name: '3mm PVC Backer', costKey: 'Cost_Sub_PVC' },
      '6mm': { cost: num(config.Cost_Stock_6mm_4x8, "58.37"), yield: 4608, name: '6mm PVC Backer', costKey: 'Cost_Stock_6mm_4x8' },
      '3/16': { cost: num(config.Cost_Sub_Acrylic, "91.65"), yield: 4608, name: '3/16" Clear Acr', costKey: 'Cost_Sub_Acrylic' },
      '1/32_CLR': { cost: num(config.ADA_APP_132_CLR, "58.12"), yield: 1152, name: '1/32" Clear Lens', costKey: 'ADA_APP_132_CLR' }
    };

    let hasCNC = false;
    let solidLayers = 0;
    let tactileLayers = 0;
    let addonMaterialCost = 0;
    
    let safeLayers = inputs.layers || [];
    if(safeLayers.length > 0) {
      safeLayers.forEach((l: any) => {
        if (matDict[l.type]) {
          let m = matDict[l.type];
          let layerCost = (totalSqin * (m.cost / m.yield)) * wastePct;
          
          // INJECTED PRECISE MATH VARIABLES
          L(`${m.name} (${l.isBase ? 'Base' : 'Add-on'})`, layerCost, `(${totalSqin.toFixed(1)} SqIn * ${V(m.costKey, String(m.cost))} / ${m.yield}) * ${V('Waste_Factor', "1.15")}`);
          
          if (!l.isBase) addonMaterialCost += layerCost;
          if (l.type === '3mm' || l.type === '6mm' || l.type === '3/16') hasCNC = true;
          if (l.type === '1/32' || l.type === '1/32_CLR') tactileLayers++;
          else solidLayers++;
        }
      });
    }

    let tapeLayers = Math.max(0, solidLayers - 1);
    if (inputs.mounting === 'Foam Tape') tapeLayers++;

    L(`File Preflight`, (num(config.Time_Preflight_Job, "15") / 60) * rateOp, `${V('Time_Preflight_Job', "15")} Mins * ${V('Rate_Operator', "25")}/hr`);
    L(`Engraver Handling`, (num(config.Time_Engraver_Load_Per_Item, "2") * inputs.qty / 60) * rateOp, `${inputs.qty} Qty * ${V('Time_Engraver_Load_Per_Item', "2")} Mins * ${V('Rate_Operator', "25")}/hr`);
    L(`Engraver Run`, ((totalSqin * num(config.Time_Engrave_SqIn, "0.25")) / 60) * engraveRate, `${totalSqin.toFixed(1)} SqIn * ${V('Time_Engrave_SqIn', "0.25")} Mins * ${V('Rate_Machine_Engraver', "10")}/hr`);

    let totalBeads = tactileLayers > 0 ? (inputs.qty * 10) : 0;
    if (totalBeads > 0) {
      L(`Braille Beads`, totalBeads * num(config.Cost_Raster_Bead, "0.01") * wastePct, `${totalBeads} Beads * ${V('Cost_Raster_Bead', "0.01")} * ${V('Waste_Factor', "1.15")}`);
      L(`Braille Insertion`, (totalBeads * 0.05 / 60) * shopRate, `${totalBeads} Beads * 0.05 Mins * ${V('Rate_Shop_Labor', "20")}/hr`);
    }

    if (hasCNC) {
      L(`CNC Router Run`, ((totalSqin * num(config.Time_CNC_Easy_SqFt, "1") / 144) / 60) * cncRate, `(${(totalSqin/144).toFixed(2)} SqFt * ${V('Time_CNC_Easy_SqFt', "1")} Mins) * ${V('Rate_Machine_CNC', "10")}/hr`);
    }

    if (tapeLayers > 0) {
      const tapeCostLF = num(config.Cost_Hem_Tape, "0.08");
      L(`Assembly Tape (${tapeLayers} Layers)`, ((totalSqin / 144) * tapeCostLF * tapeLayers) * wastePct, `(${(totalSqin/144).toFixed(2)} SqFt * ${V('Cost_Hem_Tape', "0.08")}) * ${tapeLayers} Lyr * ${V('Waste_Factor', "1.15")}`);
      L(`Assembly Labor`, (inputs.qty * tapeLayers * 2 / 60) * shopRate, `${inputs.qty} Qty * ${tapeLayers} Lyr * 2 Mins * ${V('Rate_Shop_Labor', "20")}/hr`);
    }

    let baseRetailSqIn = inputs.product === 'BasicClear' ? num(config.Retail_Price_ADA_Basic_Clear, "1.80") : num(config.Retail_Price_ADA_Basic_AB, "1.60");
    R('Base Sign Combination', totalSqin * baseRetailSqIn, `${totalSqin.toFixed(1)} SqIn * ${V(inputs.product === 'BasicClear' ? 'Retail_Price_ADA_Basic_Clear' : 'Retail_Price_ADA_Basic_AB', String(baseRetailSqIn))}`);

    if (addonMaterialCost > 0) {
      R('Add-on Material Markup (300%)', addonMaterialCost * 3, `Add-on Hard Cost * 3.0`);
    }

    let hardCost = cst.reduce((sum, i) => sum + i.total, 0);
    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = num(config.Retail_Min_Order, "50");
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    const isMinApplied = grandTotalRaw < minOrder;

    if (isMinApplied) R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `${V('Retail_Min_Order', "50")} - Subtotal`);

    const payload = {
      retail: { unitPrice: grandTotal / inputs.qty, grandTotal, breakdown: ret, isMinApplied },
      cost: { total: hardCost * riskFactor, breakdown: cst },
      metrics: { margin: (grandTotal - (hardCost * riskFactor)) / grandTotal }
    };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})