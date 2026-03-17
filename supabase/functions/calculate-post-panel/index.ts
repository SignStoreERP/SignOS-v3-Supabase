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
            'Cost_Post_Steel_2_1/8': 2.88, 'Cost_Post_Steel_3_1/8': 3.88, 'Cost_Post_Steel_4_3/16': 9.25, 'Cost_Post_Steel_6_3/16': 13.85,
            'Cost_Frame_AlumAngle_1.5_1/8': 1.65, 'Cost_Frame_AlumAngle_2_1/8': 2.24, 'Cost_Frame_AlumAngle_3_1/8': 3.50, 'Cost_Frame_AlumAngle_4_1/8': 4.50,
            'Cost_Frame_AlumTube_1.5_1/8': 1.65, 'Cost_Frame_AlumTube_2_1/8': 2.24, 'Cost_Frame_AlumTube_3_1/8': 6.56, 'Cost_Frame_AlumTube_4_1/8': 8.84, 'Cost_Frame_AlumTube_6_1/4': 26.22,
            'Cost_Frame_SteelAngle_1.5_1/8': 1.20, 'Cost_Frame_SteelAngle_2_1/8': 1.45, 'Cost_Frame_SteelAngle_3_1/8': 2.20, 'Cost_Frame_SteelAngle_4_3/16': 3.50,
            'Cost_Frame_SteelTube_1.5_1/8': 1.20, 'Cost_Frame_SteelTube_2_1/8': 1.45, 'Cost_Frame_SteelTube_3_1/8': 3.88, 'Cost_Frame_SteelTube_4_3/16': 9.25, 'Cost_Frame_SteelTube_6_3/16': 13.85
        };

        const wastePct = parseFloat(config.Waste_Factor || "1.15");
        const riskFactor = parseFloat(config.Factor_Risk || "1.05");

        const postSizeInches = parseFloat(String(inputs.postSize)) || 2;
        const fThickMatch = String(inputs.frameMat).match(/(\d+(\.\d+)?)/);
        const fThick = fThickMatch ? parseFloat(fThickMatch) : 2;
        const isAngle = String(inputs.frameMat).includes('Angle');
        
        // Define Structure based on Panel 1 (Primary Panel)
        const primaryPanel = inputs.panels;
        const primaryW = parseFloat(primaryPanel.w) || 36;
        
        // Inside Distance (Between Posts) vs Overall Width
        let idWidth = primaryPanel.mountStyle === 'Between' ? primaryW : Math.max(1, primaryW - (postSizeInches * 2));
        let oaw = idWidth + (postSizeInches * 2);

        let topOffset = parseFloat(inputs.topOffset) || 0;
        let thag = parseFloat(inputs.thag) || 60;
        let undergroundInches = parseFloat(inputs.belowGrade) || 36;
        let exactPostInches = thag + undergroundInches;

        const billedPostFt = Math.ceil(exactPostInches / 12); 
        const totalPoleLF = billedPostFt * 2 * inputs.qty;

        let totalPanelSqFt = 0, totalFrameLF = 0;
        let miterSawCuts = 0, bandSawCuts = 0;
        let frameCutsRaw = 0, postCutsRaw = 2; 
        
        let totalSkinSqIn = 0;
        let currentY = topOffset;
        let frameCutDesc: string[] = [];

        inputs.panels.forEach((p: any, idx: number) => {
            let pw = parseFloat(p.w) || 36;
            let ph = parseFloat(p.h) || 24;
            
            if (idx > 0) currentY += parseFloat(p.gap) || 0;
            p.y = currentY;

            let pLF = 0, pCuts = 0;
            let pDesc: string[] = [];

            if (p.mountStyle === 'Between') {
                // BETWEEN: Frame is a full 4-piece box. Horizontals span full width, Verticals span between them.
                let vLen = ph - (fThick * 2);
                pLF += (pw * 2) / 12; // Top & Bot
                pLF += (vLen * 2) / 12; // Left & Right
                pCuts += 4;
                pDesc.push(`(x2) ${pw}" Horizontals | (x2) ${vLen}" Verticals`);
                
                if (isAngle) totalSkinSqIn += (pw * postSizeInches * 2) * inputs.qty;
                
            } else {
                // FLUSH: Posts align to outer edge of panel. Frame is ONLY Top & Bottom horizontals spanning the Inner Distance.
                let innerDist = Math.max(1, pw - (postSizeInches * 2));
                pLF += (innerDist * 2) / 12; // Top & Bot only
                pCuts += 2;
                pDesc.push(`(x2) ${innerDist}" Horizontals`);
                
                if (isAngle || fThick < postSizeInches) {
                    totalSkinSqIn += (pw * postSizeInches * 2) * inputs.qty;
                }
            }

            let fMult = (p.sides === 2 && isAngle) ? 2 : 1;
            totalFrameLF += (pLF * fMult) * inputs.qty;
            frameCutsRaw += (pCuts * fMult) * inputs.qty;

            let pArea = (pw * ph) / 144 * inputs.qty * (p.sides === 2 ? 2 : 1);
            totalPanelSqFt += pArea;

            currentY += ph;
            frameCutDesc.push(`P${idx+1} [${p.mountStyle}]: ` + pDesc.join(''));
        });
        
        postCutsRaw += 2; 
        if (fThick > 4) bandSawCuts += frameCutsRaw;
        else miterSawCuts += frameCutsRaw;
        if (postSizeInches > 4) bandSawCuts += postCutsRaw * inputs.qty;
        else miterSawCuts += postCutsRaw * inputs.qty;

        const postKey = `Cost_Post_${inputs.postType}_${inputs.postSize}_${inputs.postType === 'Aluminum' ? '1/8' : '3/16'}`;
        if(!config[postKey]) config[postKey] = FALLBACK_METALS[postKey] || 8.84;
        
        const postCostLF = parseFloat(config[postKey]);
        L(`Structural Posts (${inputs.postType} ${postSizeInches}")`, totalPoleLF * postCostLF * wastePct, `${billedPostFt} LF/Post * 2 * Qty * $${postCostLF.toFixed(2)}/LF * Waste`, 'posts', 'struct_mat', { cut: `${(exactPostInches/12).toFixed(2)}' L (x${inputs.qty*2})` });

        if(inputs.hasConcrete) {
            const holeRadiusFt = (parseFloat(config.Hole_Diameter_Inches || "12") / 2) / 12;
            const postRadiusFt = (postSizeInches / 2) / 12;
            const concreteCuFtReq = ((Math.PI * Math.pow(holeRadiusFt, 2)) - (Math.PI * Math.pow(postRadiusFt, 2))) * (undergroundInches / 12) * 2 * inputs.qty;
            const bagsReq = Math.ceil(concreteCuFtReq / parseFloat(config.Yield_Concrete_Bag_CuFt || "0.60"));
            L(`Concrete Foundation (80lb Bags)`, bagsReq * parseFloat(config.Cost_Concrete_Bag || "4.50"), `${bagsReq} Bags * $${parseFloat(config.Cost_Concrete_Bag || "4.50").toFixed(2)}/ea`, 'posts', 'concrete');
        }

        const frameKey = `Cost_Frame_${inputs.frameMat}`;
        if(!config[frameKey]) config[frameKey] = FALLBACK_METALS[frameKey] || 1.85;
        L(`Internal Frame (${inputs.frameMat.replace(/[^a-zA-Z0-9.]/g, ' ')} ${fThick}")`, totalFrameLF * parseFloat(config[frameKey]) * wastePct, `${totalFrameLF.toFixed(1)} LF * $${parseFloat(config[frameKey]).toFixed(2)}/LF * Waste`, 'posts', 'struct_mat');

        const rateShop = parseFloat(config.Rate_Shop_Labor || "150");
        L(`Gather Materials`, (parseFloat(config.Time_Gather_Mats || "10") * inputs.qty / 60) * rateShop, `10 Mins/Sign * Qty * $${rateShop}/hr`, 'finish', 'struct_lab');

        if (miterSawCuts > 0) L(`Miter Saw Cuts (<= 4")`, (miterSawCuts * parseFloat(config.Time_Saw_Miter || "5") / 60) * rateShop, `${miterSawCuts} Cuts * 5 Mins * $${rateShop}/hr`, 'finish', 'struct_lab');
        if (bandSawCuts > 0) L(`Band Saw Cuts (> 4")`, (bandSawCuts * parseFloat(config.Time_Saw_Band || "10") / 60) * rateShop, `${bandSawCuts} Cuts * 10 Mins * $${rateShop}/hr`, 'finish', 'struct_lab');

        const weldLocs = frameCutsRaw;
        L(`Tack Welding`, ((weldLocs * parseFloat(config.Time_Weld_Per_Loc || "1.5")) / 60) * rateShop, `${weldLocs} Locs * 1.5 Mins * $${rateShop}/hr`, 'finish', 'struct_lab');
        L(`Weld Cleaning & Grinding`, ((weldLocs * parseFloat(config.Time_Clean_Weld_Loc || "0.33")) / 60) * rateShop, `${weldLocs} Locs * 0.33 Mins * $${rateShop}/hr`, 'finish', 'struct_lab');

        const adhYield = parseFloat(config.Yield_Adhesive_Tube_LF || "10");
        L(`Lord's Adhesive (Metal Glue)`, Math.ceil(totalFrameLF / adhYield) * parseFloat(config.Cost_Adhesive_Tube || "18.71"), `${Math.ceil(totalFrameLF / adhYield)} Cartridges * $${parseFloat(config.Cost_Adhesive_Tube || "18.71").toFixed(2)}/ea`, 'finish', 'struct_mat');

        let adhMins = inputs.panels.reduce((sum: number, p: any) => sum + (p.sides * inputs.qty), 0) * parseFloat(config.Time_Adhesive_Per_Face || "7");
        L(`Adhesive Application`, (adhMins / 60) * rateShop, `${adhMins} Mins * $${rateShop}/hr`, 'finish', 'struct_lab');

        const matCache: any = {};
        inputs.panels.forEach((p: any) => {
            let subCost = 1.50, subKey = 'Cost_Stock_063_4x8';
            if (p.faceMat === '040 Alum') { subCost = parseFloat(config.Cost_Stock_040_4x8 || "84.44") / 32; subKey = 'Cost_Stock_040_4x8'; }
            else if (p.faceMat === '063 Alum') { subCost = parseFloat(config.Cost_Stock_063_4x8 || "98.12") / 32; subKey = 'Cost_Stock_063_4x8'; }
            else if (p.faceMat === '080 Alum') { subCost = parseFloat(config.Cost_Stock_080_4x8 || "124.57") / 32; subKey = 'Cost_Stock_080_4x8'; }
            else if (p.faceMat === '3mm ACM') { subCost = parseFloat(config.Cost_Stock_3mm_4x8 || "52.09") / 32; subKey = 'Cost_Stock_3mm_4x8'; }
            else if (p.faceMat === '6mm ACM') { subCost = parseFloat(config.Cost_Stock_6mm_4x8 || "72.10") / 32; subKey = 'Cost_Stock_6mm_4x8'; }
            
            let sqft = (p.w * p.h) / 144 * inputs.qty * (p.sides === 2 ? 2 : 1);
            if(!matCache[subKey]) matCache[subKey] = { name: p.faceMat, cost: subCost, sqft: 0, key: subKey };
            matCache[subKey].sqft += sqft;
        });

        for(const [key, m] of Object.entries(matCache) as any) {
            L(`Face Substrate (${m.name})`, m.sqft * m.cost * wastePct, `${m.sqft.toFixed(1)} SF * $${m.cost.toFixed(2)}/SF * Waste`, 'faces', 'struct_mat');
        }
        
        if (totalSkinSqIn > 0) {
            L(`Top/Bot Skinning`, (totalSkinSqIn / 144) * 3.06 * wastePct, `${(totalSkinSqIn/144).toFixed(1)} SF Skin * Waste`, 'faces', 'struct_mat');
        }

        const rateOp = parseFloat(config.Rate_Operator || "150");
        L(`Job Setup (File RIP)`, (parseFloat(config.Time_Setup_Job || "15") * inputs.qty / 60) * rateOp, `15 Mins * Qty * $${rateOp}/hr`, 'graphics', 'graphics');

        L(`Cast Vinyl Media`, totalPanelSqFt * parseFloat(config.Cost_Vin_Cast || "1.30") * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $1.30/SF * Waste`, 'graphics', 'graphics');
        L(`Latex Ink`, totalPanelSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $0.16/SF * Waste`, 'graphics', 'graphics');
        L(`Print Machine Run`, (totalPanelSqFt / parseFloat(config.Speed_Print_Roll || "150")) * parseFloat(config.Rate_Machine_Print || "5"), `${totalPanelSqFt.toFixed(1)} SF / 150 SF/hr * $5/hr`, 'graphics', 'graphics');
        L(`Overlaminate Media`, totalPanelSqFt * parseFloat(config.Cost_Lam_Cast || "0.96") * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $0.96/SF * Waste`, 'graphics', 'graphics');
        L(`Vinyl Mount Labor`, ((totalPanelSqFt * parseFloat(config.Time_Mount_Flat_SqFt || "0.25")) / 60) * rateShop, `${totalPanelSqFt.toFixed(1)} SF * 0.25 Mins/SF * $${rateShop}/hr`, 'graphics', 'graphics');

        const ratePaint = parseFloat(config.Rate_Paint_Labor || "150");
        let totalPaintSqFt = ((postSizeInches / 12) * 4 * totalPoleLF) + totalPanelSqFt;
        
        L(`Automotive Paint (Polyurethane)`, totalPaintSqFt * parseFloat(config.Cost_Paint_SqFt || "2.50") * wastePct, `${totalPaintSqFt.toFixed(1)} SF * $2.50/SF * Waste`, 'finish', 'paint_mat');
        L(`Paint Setup & Gun Clean`, (parseFloat(config.Time_Paint_Setup || "20") * inputs.qty / 60) * ratePaint, `20 Mins * Qty * $${ratePaint}/hr`, 'finish', 'paint_lab');
        L(`Sanding & Prep`, ((totalPaintSqFt * parseFloat(config.Time_Paint_Prep_SqFt || "0.125")) / 60) * ratePaint, `${totalPaintSqFt.toFixed(1)} SF * 0.125 Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab');
        L(`Primer Coat`, ((totalPaintSqFt * parseFloat(config.Time_Paint_Primer_SqFt || "0.104")) / 60) * ratePaint, `${totalPaintSqFt.toFixed(1)} SF * 0.104 Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab');
        L(`Finish Coat (Color & Clear)`, ((totalPaintSqFt * parseFloat(config.Time_Paint_Finish_SqFt || "0.312")) / 60) * ratePaint, `${totalPaintSqFt.toFixed(1)} SF * 0.312 Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab');

        let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
        const totalCost = hardCostRaw * riskFactor;
        const targetMargin = parseFloat(config.Target_Margin_Pct || "0.60");
        let grandTotalRaw = totalCost / (1 - targetMargin);

        const minOrder = parseFloat(config.Retail_Min_Order || "150");
        let isMinApplied = false; 
        let grandTotal = grandTotalRaw;
        if (grandTotalRaw < minOrder) { grandTotal = minOrder; isMinApplied = true; }

        const retBreakdown = [{ label: `Market Value (${(targetMargin*100).toFixed(1)}% Profit Margin)`, total: grandTotalRaw, formula: `Total Hard Cost / (1 - 0.${(targetMargin*100).toFixed(0)})` }];
        if (isMinApplied) retBreakdown.push({ label: 'Shop Minimum Surcharge', total: minOrder - grandTotalRaw, formula: 'Minimum order difference' });

        const geometry = {
            panels: inputs.panels, postSpacing: idWidth, post: postSizeInches,
            clearance: Math.max(0, thag - currentY), hasConcrete: inputs.hasConcrete, holeD: parseFloat(config.Hole_Diameter_Inches || "12"),
            above: thag, under: undergroundInches, totalPanelH: currentY - topOffset, topOffset: topOffset,
            overallW: oaw, frameThick: fThick, cutList: frameCutDesc
        };

        const payload = {
            retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: retBreakdown, isMinApplied: isMinApplied },
            cost: { total: totalCost, breakdown: cst }, metrics: { margin: targetMargin }, geom: geometry
        };

        return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders }); }
});