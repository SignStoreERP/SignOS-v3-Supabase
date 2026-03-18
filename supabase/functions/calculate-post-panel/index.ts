declare const Deno: any;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const requestData = await req.json();
    const inputs = requestData.inputs || {};
    const config = requestData.config || {};
    const auditMode = requestData.audit_mode || 'retail_only'; 

    const ret: any[] = [];
    const cst: any[] = [];
    const num = (k: string, fallback: number) => { const p = parseFloat(config[k]); return isNaN(p) ? fallback : p; };
    const R = (label: string, total: number, formula: string) => { if (total !== 0) ret.push({label, total, formula}); return total; };
    const L = (label: string, total: number, formula: string) => { if (total !== 0) cst.push({label, total, formula}); return total; };

    // ============================================================================
    // PHASE 1: THE BUILDER (Geometry & Bill of Materials)
    // Pure physics simulation. Zero financial math occurs here.
    // ============================================================================
    
    const qty = parseInt(inputs.qty) || 1;
    const thag = parseFloat(inputs.thag) || 60;
    const belowGrade = parseFloat(inputs.belowGrade) || 36;
    const postType = inputs.postType || 'Aluminum';
    const postSize = parseFloat(inputs.postSize) || 2;
    const fThickMatch = (inputs.frameMat || '').match(/(\d+(\.\d+)?)/);
    const fThick = fThickMatch ? parseFloat(fThickMatch) : 2;
    const panels = inputs.panels || [];

    let bom = {
        postLF: 0,
        frameLF: 0,
        faceSqFt: 0,
        concreteBags: 2, // Standard 1 bag per post hole
        adhesiveTubes: 0,
        paintSqFt: 0,
        weldPoints: 0,
        sawCuts: 0,
        shearCuts: 0
    };

    // 1A. Simulate Posts
    const singlePostLength = thag + belowGrade;
    bom.postLF = (singlePostLength * 2) / 12; // Two posts converted to Linear Feet
    bom.paintSqFt += (bom.postLF * (postSize * 4)) / 144; // Post surface area
    bom.sawCuts += 2; 

    // 1B. Simulate Internal Frames and Faces
    panels.forEach((p: any) => {
        const pW = parseFloat(p.w) || 24;
        const pH = parseFloat(p.h) || 24;
        const isFlush = p.flush === true || String(p.flush) === 'true';
        const sides = parseInt(p.sides) || 1;

        const faceArea = (pW * pH) / 144;
        bom.faceSqFt += faceArea * sides;
        bom.shearCuts += 4 * sides; 
        bom.paintSqFt += faceArea * sides; 

        // Flush vs Between Mount Spatial Logic
        if (isFlush) {
            // Posts are inset. Frame is just horizontal stringers bridging the posts.
            let frameW = pW - (postSize * 2);
            bom.frameLF += (frameW * 2) / 12; 
            bom.weldPoints += 4; 
            bom.sawCuts += 2;
        } else {
            // Posts are outside. Frame is a full 4-piece structural box.
            let frameW = pW;
            let frameH = pH - (fThick * 2);
            bom.frameLF += ((frameW * 2) + (frameH * 2)) / 12;
            bom.weldPoints += 8; // 4 corners + 4 to posts
            bom.sawCuts += 4;
        }

        bom.adhesiveTubes += (faceArea / 15) * sides; // Approx 1 tube per 15 SqFt of face
    });
    bom.adhesiveTubes = Math.ceil(bom.adhesiveTubes);


    // ============================================================================
    // PHASE 2: THE VALUATOR (Physics & Cost Engine)
    // Cross-references the physical BOM against global dictionaries and shop rates
    // ============================================================================
    
    const waste = num('Waste_Factor', 1.15);
    const rateShop = num('Rate_Shop_Labor', 20);
    const rateCNC = num('Rate_CNC_Labor', 25); 
    const ratePaint = num('Rate_Paint_Labor', 30);

    // Fallbacks map to your typical shop standards if a variable is missing
    const costPost = num(`Cost_Post_${postType}_${postSize}`, postSize * 3); 
    const costFrame = num(`Cost_Frame_${inputs.frameMat}`, fThick * 2);
    const costFace = num('Cost_Stock_063_4x8', 98.12) / 32; 
    const costConcrete = num('Cost_Concrete_Bag', 6.00);
    const costAdhesive = num('Cost_Adhesive_Tube', 18.71);
    const costPaint = num('Cost_Paint_SqFt', 2.50);

    let totalMat = 0;
    let totalLab = 0;

    if (auditMode === 'full' || auditMode === 'cost_only') {
        // Material Mapping
        totalMat += L(`Structural Posts (${postType} ${postSize}")`, bom.postLF * costPost * waste, `${bom.postLF.toFixed(1)} LF @ $${costPost.toFixed(2)}/lf * Waste`);
        totalMat += L(`Internal Frame (${inputs.frameMat})`, bom.frameLF * costFrame * waste, `${bom.frameLF.toFixed(1)} LF @ $${costFrame.toFixed(2)}/lf * Waste`);
        totalMat += L(`Sign Faces (.063 Alum)`, bom.faceSqFt * costFace * waste, `${bom.faceSqFt.toFixed(1)} SF @ $${costFace.toFixed(2)}/sf * Waste`);
        totalMat += L(`Concrete Footings`, bom.concreteBags * costConcrete, `${bom.concreteBags} Bags @ $${costConcrete.toFixed(2)}/ea`);
        totalMat += L(`Structural Adhesive`, bom.adhesiveTubes * costAdhesive, `${bom.adhesiveTubes} Tubes @ $${costAdhesive.toFixed(2)}/ea`);

        // Labor Mapping
        const timeCut = (bom.sawCuts * 2) / 60; // 2 mins per saw cut
        const timeShear = (bom.shearCuts * 1) / 60; // 1 min per shear cut
        const timeWeld = (bom.weldPoints * num('Time_Weld_Per_Loc', 5)) / 60; 
        const timePaint = (bom.paintSqFt * num('Time_Paint_SqIn', 0.1) * 144) / 60; 

        totalLab += L(`Saw & Shear Operations`, (timeCut + timeShear) * rateShop, `${((timeCut + timeShear)*60).toFixed(0)} Mins @ $${rateShop}/hr`);
        totalLab += L(`Welding & Grinding`, timeWeld * rateCNC, `${(timeWeld*60).toFixed(0)} Mins @ $${rateCNC}/hr`);
        
        if (bom.paintSqFt > 0) {
            totalMat += L(`Paint & Finish Materials`, bom.paintSqFt * costPaint, `${bom.paintSqFt.toFixed(1)} SF @ $${costPaint.toFixed(2)}/sf`);
            totalLab += L(`Painting Labor`, timePaint * ratePaint, `${(timePaint*60).toFixed(0)} Mins @ $${ratePaint}/hr`);
        }
    }

    const totalHardCost = (totalMat + totalLab) * num('Factor_Risk', 1.10) * qty;

    // ============================================================================
    // PHASE 3: THE RETAIL ENGINE (Markup & Bounds)
    // Financial conversion using bidirectional target margin limits
    // ============================================================================
    
    // Bidirectional Margin Math: Price = Cost / (1 - Target Margin)
    const targetMargin = num('Target_Margin_Pct', 0.60); // 60% Margin Standard
    let grandTotalRaw = totalHardCost / (1 - targetMargin);

    const minOrder = num('Retail_Min_Order', 150) * qty;
    let grandTotal = grandTotalRaw;
    let isMinApplied = false;

    if (grandTotalRaw < minOrder) {
        grandTotal = minOrder;
        isMinApplied = true;
    }

    const unitPrice = grandTotal / qty;
    
    R(`Post & Panel Fabrication`, grandTotalRaw, `Total Hard Cost / (1 - ${(targetMargin*100).toFixed(0)}% Target Margin)`);
    if (isMinApplied) R(`Shop Minimum Surcharge`, minOrder - grandTotalRaw, `Difference applied to reach $${minOrder}`);

    // Return the strict JSON Data Contract required by the "Dumb" Frontend
    const payload = { 
        retail: { unitPrice, grandTotal, breakdown: ret, isMinApplied }, 
        cost: { total: totalHardCost, breakdown: cst }, 
        metrics: { margin: (grandTotal - totalHardCost) / grandTotal },
        geom: inputs // Returns the structural parameters for the 2D visualizer
    };

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) { 
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders }); 
  }
});