const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { inputs, config } = await req.json()
    const cst: any[] = [];

    const getDesc = (k: string) => config['META_NOTE_' + k] || "System parameter.";
    const V = (k: string) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const L = (label: string, total: number, formula: string, rB?: string, cB?: string, meta: any = {}) => {
      if(total > 0) cst.push({label, total, formula, rB, cB, meta});
      return total;
    };

    const FALLBACK_METALS: any = {
      'Cost_Post_Aluminum_2_1/8': 4.28, 'Cost_Post_Aluminum_3_1/8': 6.56, 'Cost_Post_Aluminum_4_1/8': 8.84, 'Cost_Post_Aluminum_6_1/4': 26.22,
      'Cost_Post_Steel_3_1/8': 3.88, 'Cost_Post_Steel_3_3/16': 5.85, 'Cost_Post_Steel_4_3/16': 9.25, 'Cost_Post_Steel_6_3/16': 13.85, 'Cost_Post_Steel_6_1/4': 18.75, 'Cost_Post_Steel_8_3/16': 21.60, 'Cost_Post_Steel_8_1/4': 24.25, 'Cost_Post_Steel_10_1/4': 27.75, 'Cost_Post_Steel_12_1/4': 33.55,
      'Cost_Frame_Angle15': 1.45, 'Cost_Frame_Angle20': 1.85, 'Cost_Frame_Tube10': 1.65, 'Cost_Frame_Tube20': 2.15, 'Cost_Frame_Alum15': 2.55, 'Cost_Frame_Alum20': 3.45
    };

    const aboveGroundFt = inputs.aboveGrade / 12;
    const undergroundFt = inputs.belowGrade / 12;
    const totalPostFt = aboveGroundFt + undergroundFt;
    const totalPoleLF = totalPostFt * 2 * inputs.qty;
    
    // FIXED: Extracted the first index of the split array for TypeScript safety!
    const postSizeInches = parseFloat(String(inputs.postProfile).split('_')) || 3;
    const fThick = parseFloat(String(inputs.frameMat).split('_')) || 2;
    
    const wastePct = parseFloat(config.Waste_Factor || "1.15");
    const riskFactor = parseFloat(config.Factor_Risk || "1.05");

    let totalPanelSqFt = 0;
    let totalFrameLF = 0;
    let totalFrameCuts = 0;
    let maxOverallW = inputs.postSpacing;
    let totalPanelH = 0;
    let frameCutDesc: string[] = [];

    inputs.panels.forEach((p: any, idx: number) => {
      let area = (p.w * p.h) / 144 * inputs.qty;
      totalPanelSqFt += area;
      totalPanelH += p.h;
      if (p.w + (inputs.mountStyle === 'Between' ? postSizeInches * 2 : 0) > maxOverallW) {
        maxOverallW = p.w + (inputs.mountStyle === 'Between' ? postSizeInches * 2 : 0);
      }
      let topBotLF = (p.w * 2) / 12;
      let leftRightLF = ((p.h - (fThick * 2)) * 2) / 12;
      let pnlFrLF = (topBotLF + leftRightLF) * inputs.qty;
      totalFrameLF += pnlFrLF;
      totalFrameCuts += (4 * inputs.qty);
      frameCutDesc.push(`Panel ${idx+1}: ${p.w}" (x2), ${p.h - (fThick*2)}" (x2)`);
    });

    const postKey = `Cost_Post_${inputs.postType}_${inputs.postProfile}`;
    if(!config[postKey]) config[postKey] = FALLBACK_METALS[postKey] || 6.56;
    const postCostLF = parseFloat(config[postKey]);
    let postRaw = totalPoleLF * postCostLF;
    let postTotal = postRaw * wastePct;
    L(`Structural Posts (${inputs.postType} ${postSizeInches}")`, postTotal, `${totalPoleLF.toFixed(1)} LF * $${postCostLF.toFixed(2)}/LF [${V(postKey)}] * ${wastePct} Waste`, 'posts', 'struct_mat', { waste: postTotal - postRaw, cut: `${totalPostFt.toFixed(1)}' L (x${inputs.qty*2})` });

    if(inputs.hasConcrete) {
      const holeDiamInches = parseFloat(config.Hole_Diameter_Inches || "12");
      const holeRadiusFt = (holeDiamInches / 2) / 12;
      const holeVolCuFt = Math.PI * Math.pow(holeRadiusFt, 2) * undergroundFt;
      const postRadiusFt = (postSizeInches / 2) / 12;
      const postVolCuFt = Math.PI * Math.pow(postRadiusFt, 2) * undergroundFt;
      const concreteCuFtReq = (holeVolCuFt - postVolCuFt) * 2 * inputs.qty;
      const bagYieldCuFt = parseFloat(config.Yield_Concrete_80lb_CuFt || "0.60");
      const bagsReq = Math.ceil(concreteCuFtReq / bagYieldCuFt);
      const concreteCost = parseFloat(config.Cost_Concrete_80lb || "5.50");
      L(`Concrete Foundation (80lb Bags)`, bagsReq * concreteCost, `${bagsReq} Bags * $${concreteCost.toFixed(2)}/ea [${V('Cost_Concrete_80lb')}]`, 'posts', 'concrete');
    }

    const frameKey = `Cost_Frame_${inputs.frameMat}`;
    if(!config[frameKey]) config[frameKey] = FALLBACK_METALS[frameKey] || 1.45;
    const frameCostLF = parseFloat(config[frameKey]);
    let frameRaw = totalFrameLF * frameCostLF;
    let frameTotal = frameRaw * wastePct;
    L(`Internal Frame (${inputs.frameMat.split('_')})`, frameTotal, `${totalFrameLF.toFixed(1)} LF * $${frameCostLF.toFixed(2)}/LF [${V(frameKey)}] * ${wastePct} Waste`, 'posts', 'struct_mat', { waste: frameTotal - frameRaw });

    const rateShop = parseFloat(config.Rate_Shop_Labor || "20");
    let gatherMins = parseFloat(config.Time_Gather_Mats || "10") * inputs.qty;
    L(`Gather Materials`, (gatherMins / 60) * rateShop, `${gatherMins} Mins [${V('Time_Gather_Mats')}] * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: gatherMins });

    const isMiterPost = inputs.postType === 'Aluminum' && postSizeInches <= 4;
    const isMiterFrame = inputs.frameMat.includes('Alum') && fThick <= 4;
    const timeMiter = parseFloat(config.Time_Saw_Miter || "5");
    const timeBand = parseFloat(config.Time_Saw_Band || "10");
    const postSawMins = (2 * inputs.qty) * (isMiterPost ? timeMiter : timeBand);
    L(`Post Cuts (${isMiterPost ? "Miter Saw" : "Band Saw"})`, (postSawMins / 60) * rateShop, `${2 * inputs.qty} Cuts * ${(postSawMins/(2*inputs.qty))} Mins * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: postSawMins });

    const frameSawMins = totalFrameCuts * (isMiterFrame ? timeMiter : timeBand);
    L(`Frame Cuts (${isMiterFrame ? "Miter Saw" : "Band Saw"})`, (frameSawMins / 60) * rateShop, `${totalFrameCuts} Cuts * ${(isMiterFrame ? timeMiter : timeBand)} Mins * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: frameSawMins });

    const weldLocs = totalFrameCuts;
    const timeWeldLoc = parseFloat(config.Time_Weld_Per_Loc || "1.5");
    const timeCleanLoc = parseFloat(config.Time_Clean_Weld_Loc || "0.33");
    L(`Tack Welding`, ((weldLocs * timeWeldLoc) / 60) * rateShop, `${weldLocs} Locs * ${timeWeldLoc} Mins [${V('Time_Weld_Per_Loc')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: weldLocs * timeWeldLoc });
    L(`Weld Cleaning & Grinding`, ((weldLocs * timeCleanLoc) / 60) * rateShop, `${weldLocs} Locs * ${timeCleanLoc} Mins [${V('Time_Clean_Weld_Loc')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: weldLocs * timeCleanLoc });

    const adhYield = parseFloat(config.Yield_Adhesive_Tube_LF || "10");
    const adhCost = parseFloat(config.Cost_Adhesive_Tube || "18.71");
    const cartridges = Math.ceil(totalFrameLF / adhYield);
    L(`Lord's Adhesive (Metal Glue)`, cartridges * adhCost, `${cartridges} Cartridges (Chunks of ${adhYield} LF [${V('Yield_Adhesive_Tube_LF')}]) * $${adhCost.toFixed(2)}/ea [${V('Cost_Adhesive_Tube')}]`, 'finish', 'struct_mat');

    let totalSides = 0;
    inputs.panels.forEach((p: any) => { totalSides += p.sides * inputs.qty; });
    let adhMins = totalSides * parseFloat(config.Time_Adhesive_Per_Face || "7");
    L(`Adhesive Application`, (adhMins / 60) * rateShop, `${totalSides} Sides * ${parseFloat(config.Time_Adhesive_Per_Face || "7")} Mins/Face [${V('Time_Adhesive_Per_Face')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: adhMins });

    const matCache: any = {};
    inputs.panels.forEach((p: any) => {
      let subCost = 1.50, subKey = 'Cost_Stock_063_4x8';
      if (p.faceMat === '040 Alum') { subCost = parseFloat(config.Cost_Stock_040_4x8 || "84.44") / 32; subKey = 'Cost_Stock_040_4x8'; }
      else if (p.faceMat === '080 Alum') { subCost = parseFloat(config.Cost_Stock_080_4x8 || "124.57") / 32; subKey = 'Cost_Stock_080_4x8'; }
      else if (p.faceMat === '3mm ACM') { subCost = parseFloat(config.Cost_Stock_3mm_4x8 || "52.09") / 32; subKey = 'Cost_Stock_3mm_4x8'; }
      else if (p.faceMat === '6mm ACM') { subCost = parseFloat(config.Cost_Stock_6mm_4x8 || "72.10") / 32; subKey = 'Cost_Stock_6mm_4x8'; }

      let sqft = (p.w * p.h) / 144 * inputs.qty * (p.sides === 2 ? 2 : 1);
      if(!matCache[subKey]) matCache[subKey] = { name: p.faceMat, cost: subCost, sqft: 0, isCNC: false };
      matCache[subKey].sqft += sqft;
      if(p.isCNC) matCache[subKey].isCNC = true;
    });

    for(const [key, m] of Object.entries(matCache) as any) {
      let faceRaw = m.sqft * m.cost;
      let faceTotal = faceRaw * wastePct;
      L(`Face Substrate (${m.name})`, faceTotal, `${m.sqft.toFixed(1)} SF * $${m.cost.toFixed(2)}/SF [${V(key)}] * ${wastePct} Waste`, 'faces', 'struct_mat', { waste: faceTotal - faceRaw });
      if (m.isCNC) {
        let cncSetup = parseFloat(config.Time_Setup_CNC || "10") * inputs.qty;
        let cncRun = m.sqft * parseFloat(config.Time_CNC_Easy_SqFt || "1");
        L(`CNC Router Setup`, (cncSetup / 60) * parseFloat(config.Rate_CNC_Labor || "25"), `${cncSetup} Mins Setup * $${parseFloat(config.Rate_CNC_Labor || "25")}/hr [${V('Rate_CNC_Labor')}]`, 'faces', 'struct_lab', { time: cncSetup });
        L(`CNC Machine Run`, (cncRun / 60) * parseFloat(config.Rate_Machine_CNC || "10"), `${m.sqft.toFixed(1)} SF * ${parseFloat(config.Time_CNC_Easy_SqFt || "1")} Mins/SF * $${parseFloat(config.Rate_Machine_CNC || "10")}/hr [${V('Rate_Machine_CNC')}]`, 'faces', 'struct_lab', { time: cncRun });
      }
    }

    const rateOp = parseFloat(config.Rate_Operator || "25");
    const machPrint = parseFloat(config.Rate_Machine_Print || "5");
    let totalPaintSqFt = (totalPoleLF * (postSizeInches * 4 / 12)) + (inputs.panels.reduce((sum: number, p: any) => sum + (p.w * p.h)/144 * p.sides * inputs.qty, 0));

    if (inputs.finishType === 'Printed') {
      let setupJob = parseFloat(config.Time_Setup_Job || "15") * inputs.qty;
      L(`Job Setup (File RIP)`, (setupJob / 60) * rateOp, `${setupJob} Mins [${V('Time_Setup_Job')}] * $${rateOp}/hr [${V('Rate_Operator')}]`, 'graphics', 'graphics', { time: setupJob });

      const vinylCost = parseFloat(config.Cost_Vin_Cast || "1.30");
      const inkCost = parseFloat(config.Cost_Ink_Latex || "0.16");
      let vinylRaw = totalPanelSqFt * vinylCost;
      let inkRaw = totalPanelSqFt * inkCost;
      L(`Cast Vinyl Media`, vinylRaw * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $${vinylCost.toFixed(2)}/SF [${V('Cost_Vin_Cast')}] * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (vinylRaw * wastePct) - vinylRaw });
      L(`Latex Ink`, inkRaw * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $${inkCost.toFixed(2)}/SF [${V('Cost_Ink_Latex')}] * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (inkRaw * wastePct) - inkRaw });

      let printHrs = (totalPanelSqFt / parseFloat(config.Speed_Print_Roll || "150"));
      L(`Print Machine Run`, printHrs * machPrint, `${totalPanelSqFt.toFixed(1)} SF / ${parseFloat(config.Speed_Print_Roll || "150")} SF/hr [${V('Speed_Print_Roll')}] * $${machPrint}/hr [${V('Rate_Machine_Print')}]`, 'graphics', 'graphics', { time: printHrs * 60 });

      if (inputs.isCutVinyl) {
        L(`Transfer Tape (Pre-Mask)`, totalPanelSqFt * parseFloat(config.Cost_Transfer_Tape || "0.15") * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $0.15/SF [${V('Cost_Transfer_Tape')}] * ${wastePct} Waste`, 'graphics', 'graphics');
        const cutHrs = totalPanelSqFt / parseFloat(config.Speed_Cut_Graphtec || "50");
        L(`Plotter Run`, cutHrs * parseFloat(config.Rate_Machine_Cut || "5"), `${cutHrs.toFixed(2)} Hrs * $5/hr [${V('Rate_Machine_Cut')}]`, 'graphics', 'graphics', { time: cutHrs * 60 });
        let weedMins = totalPanelSqFt * parseFloat(config.Time_Weed_Simple || "0.42");
        L(`Weeding Labor`, (weedMins / 60) * rateShop, `${totalPanelSqFt.toFixed(1)} SF * ${parseFloat(config.Time_Weed_Simple || "0.42")} Mins/SF [${V('Time_Weed_Simple')}] * $${rateShop}/hr`, 'graphics', 'graphics', { time: weedMins });
        let maskMins = totalPanelSqFt * parseFloat(config.Time_Mask_SqFt || "0.17");
        L(`Masking Labor`, (maskMins / 60) * rateShop, `${totalPanelSqFt.toFixed(1)} SF * ${parseFloat(config.Time_Mask_SqFt || "0.17")} Mins/SF [${V('Time_Mask_SqFt')}] * $${rateShop}/hr`, 'graphics', 'graphics', { time: maskMins });
      } else {
        const lamCost = parseFloat(config.Cost_Lam_Cast || "0.96");
        let lamRaw = totalPanelSqFt * lamCost;
        L(`Overlaminate Media`, lamRaw * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $${lamCost.toFixed(2)}/SF [${V('Cost_Lam_Cast')}] * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (lamRaw * wastePct) - lamRaw });
        let mountMins = totalPanelSqFt * parseFloat(config.Time_Mount_Flat_SqFt || "0.25");
        L(`Vinyl Mount Labor`, (mountMins / 60) * rateShop, `${totalPanelSqFt.toFixed(1)} SF * ${parseFloat(config.Time_Mount_Flat_SqFt || "0.25")} Mins/SF [${V('Time_Mount_Flat_SqFt')}] * $${rateShop}/hr`, 'graphics', 'graphics', { time: mountMins });
      }
    }

    const ratePaint = parseFloat(config.Rate_Paint_Labor || "30");
    const costPaintUnit = parseFloat(config.Cost_Paint_SqFt || "2.50");
    L(`Automotive Paint (Polyurethane)`, totalPaintSqFt * costPaintUnit * wastePct, `${totalPaintSqFt.toFixed(1)} SF * $${costPaintUnit.toFixed(2)}/SF [${V('Cost_Paint_SqFt')}] * ${wastePct} Waste`, 'finish', 'paint_mat', { waste: (totalPaintSqFt * costPaintUnit * wastePct) - (totalPaintSqFt * costPaintUnit) });

    let paintSetup = parseFloat(config.Time_Paint_Setup || "15") * inputs.qty;
    let paintPrep = totalPaintSqFt * parseFloat(config.Time_Paint_Prep_SqFt || "0.25");
    let paintPrime = totalPaintSqFt * parseFloat(config.Time_Paint_Primer_SqFt || "0.25");
    let paintFin = totalPaintSqFt * parseFloat(config.Time_Paint_Finish_SqFt || "0.75");
    L(`Paint Setup & Gun Clean`, (paintSetup / 60) * ratePaint, `${paintSetup} Mins [${V('Time_Paint_Setup')}] * $${ratePaint}/hr [${V('Rate_Paint_Labor')}]`, 'finish', 'paint_lab', { time: paintSetup });
    L(`Sanding & Prep`, (paintPrep / 60) * ratePaint, `${totalPaintSqFt.toFixed(1)} SF * ${parseFloat(config.Time_Paint_Prep_SqFt || "0.25")} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: paintPrep });
    L(`Primer Coat`, (paintPrime / 60) * ratePaint, `${totalPaintSqFt.toFixed(1)} SF * ${parseFloat(config.Time_Paint_Primer_SqFt || "0.25")} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: paintPrime });
    L(`Finish Coat (Color & Clear)`, (paintFin / 60) * ratePaint, `${totalPaintSqFt.toFixed(1)} SF * ${parseFloat(config.Time_Paint_Finish_SqFt || "0.75")} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: paintFin });

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;
    const targetMargin = parseFloat(config.Target_Margin_Pct || "0.60");
    const overrideSales = parseFloat(config.Override_Retail_Total || "0");
    const minOrder = parseFloat(config.Retail_Min_Order || "150");

    let grandTotalRaw = overrideSales > 0 ? overrideSales : (totalCost / (1 - targetMargin));
    let grandTotal = Math.max(grandTotalRaw, minOrder);
    let isMinApplied = grandTotalRaw < minOrder;

    const lineItems = [
      { label: 'Structural Posts & Concrete', unit: cst.filter(i => i.cB === 'struct_mat' || i.cB === 'concrete').reduce((s,i)=>s+i.total,0) / inputs.qty },
      { label: 'Fabrication Labor', unit: cst.filter(i => i.cB === 'struct_lab').reduce((s,i)=>s+i.total,0) / inputs.qty },
      { label: 'Face Substrates', unit: cst.filter(i => i.cB === 'faces').reduce((s,i)=>s+i.total,0) / inputs.qty },
      { label: 'Graphics & Paint', unit: cst.filter(i => i.cB === 'graphics' || i.cB.includes('paint')).reduce((s,i)=>s+i.total,0) / inputs.qty },
      { label: `Risk Buffer (${((riskFactor-1)*100).toFixed(0)}%)`, unit: (totalCost - hardCostRaw) / inputs.qty }
    ];

    const retBreakdown = [
      { label: `Market Value (${(targetMargin*100).toFixed(1)}% Profit Margin)`, total: grandTotalRaw, formula: `Total Hard Cost / (1 - 0.${(targetMargin*100).toFixed(0)})` }
    ];

    if (isMinApplied) retBreakdown.push({ label: 'Shop Minimum Surcharge', total: minOrder - grandTotalRaw, formula: 'Minimum order difference' });

    const geometry = {
      panels: inputs.panels, postSpacing: inputs.postSpacing, post: postSizeInches, holeD: parseFloat(config.Hole_Diameter_Inches || "12"),
      clearance: inputs.clearance, hasConcrete: inputs.hasConcrete,
      above: inputs.aboveGrade, under: inputs.belowGrade, totalPanelH: totalPanelH,
      overallW: maxOverallW, frameThick: fThick, cutList: frameCutDesc
    };

    const payload = {
      retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: retBreakdown, lineItems: lineItems, isMinApplied: isMinApplied },
      cost: { total: totalCost, breakdown: cst },
      metrics: { margin: targetMargin },
      geom: geometry,
      activeKeys: [postKey, frameKey]
    };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }); }
});