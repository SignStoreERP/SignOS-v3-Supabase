declare const Deno: any;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const requestData = await req.json();
    const isArray = Array.isArray(requestData.inputs);
    const inputPayload = isArray ? requestData.inputs : [requestData.inputs];
    const config = requestData.config || {};
    const auditMode = requestData.audit_mode || 'full'; 

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    let dictionary: any[] = [];
    if ((auditMode === 'full' || auditMode === 'retail_only') && supabaseUrl && supabaseKey) {
        const res = await fetch(`${supabaseUrl}/rest/v1/ref_retail_history?select=*`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (res.ok) dictionary = await res.json();
    }

    const results = inputPayload.map((inputs: any) => {
        const reqW = parseFloat(inputs.w) || 24;
        const reqH = parseFloat(inputs.h) || 24;
        const qty = parseFloat(inputs.qty) || 1;
        const reqSides = inputs.sides === 2 ? 2 : 1;
        const thk = String(inputs.thickness || '4mm');
        const is10mm = thk.includes('10');
        
        const ret: any[] = [];
        const cst: any[] = [];
        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };
        const L = (label: string, total: number, formula: string) => { if (total > 0) cst.push({label, total, formula}); return total; };

        let grandTotalRetail = 0;
        let totalHardCost = 0;
        let printTotal = 0;
        let routerFee = 0;
        let stakeTotal = 0;

        // ==========================================
        // TIER 1: RETAIL ENGINE
        // ==========================================
        if (auditMode === 'full' || auditMode === 'retail_only') {
            let exactPrice = 0; 
            let mappedBox = "";
            let bestArea = Infinity; 
            
            const targetLine = is10mm ? '10mm Coroplast' : '4mm Coroplast';
            const targetSides = reqSides === 2 ? 'Double' : 'Single';
            const validRows = dictionary.filter((r: any) => r.product_line === targetLine && r.sides === targetSides);
            
            for (const row of validRows) {
                if (!row.dimensions || !row.dimensions.includes('x')) continue;
                const [swStr, shStr] = row.dimensions.toLowerCase().split('x');
                const sw = parseFloat(swStr); 
                const sh = parseFloat(shStr); 
                
                const fitsStandard = (sw >= reqW && sh >= reqH);
                const fitsRotated = (sh >= reqW && sw >= reqH);
                
                if (fitsStandard || fitsRotated) {
                    const area = sw * sh;
                    if (area < bestArea) {
                        bestArea = area; 
                        mappedBox = row.dimensions;
                        exactPrice = parseFloat(row.legacy_price || "0");
                    }
                }
            }
            
            if (exactPrice > 0) {
                let unitPrice = exactPrice;
                if (qty >= 10) unitPrice = unitPrice * 0.95; 
                printTotal = unitPrice * qty;
                R(`Sign Print (${thk} Rounded to ${mappedBox})`, printTotal, `${qty}x Signs @ $${unitPrice.toFixed(2)}/ea`);
            } else {
                const billedSqFt = (Math.ceil(reqW / 12) * Math.ceil(reqH / 12));
                const baseRate = is10mm ? parseFloat(config.COR10_T4_Rate || "15") : parseFloat(config.COR4_T4_Rate || "5");
                let rawUnitPrint = baseRate * billedSqFt;
                let rawUnitDS = reqSides === 2 ? rawUnitPrint * parseFloat(config.Retail_Adder_DS_Mult || "0.5") : 0;
                printTotal = (rawUnitPrint + rawUnitDS) * qty;
                R(`Oversized Print (${billedSqFt} SF)`, printTotal, `Area Fallback Math`);
            }

            // DYNAMIC ADD-ONS
            if (inputs.shape === 'CNC Simple') {
                routerFee = parseFloat(config.Retail_Fee_Router_Easy || "30");
                R(`CNC Router Fee`, routerFee, `Simple Shape Fee`);
            } else if (inputs.shape === 'CNC Complex') {
                routerFee = parseFloat(config.Retail_Fee_Router_Hard || "50");
                R(`CNC Router Fee`, routerFee, `Complex Shape Fee`);
            }

            if (inputs.hardware === 'H-Stakes') {
                const stkRate = parseFloat(config.Retail_Stake_Std || "2.50");
                stakeTotal = stkRate * qty;
                R(`Standard H-Stakes`, stakeTotal, `${qty}x Stakes @ $${stkRate.toFixed(2)}/ea`);
            } else if (inputs.hardware === 'HD-Stakes') {
                const stkRate = parseFloat(config.Retail_Stake_HD || "4.00");
                stakeTotal = stkRate * qty;
                R(`Heavy Duty Stakes`, stakeTotal, `${qty}x Stakes @ $${stkRate.toFixed(2)}/ea`);
            }
            
            let grandTotalRetailRaw = printTotal + routerFee + stakeTotal;
            const minOrder = parseFloat(config.Retail_Min_Order || "50");
            grandTotalRetail = grandTotalRetailRaw;
            let isMinApplied = false;

            if (grandTotalRetailRaw < minOrder) {
                R(`Shop Minimum Surcharge`, minOrder - grandTotalRetailRaw, `Minimum order difference`);
                grandTotalRetail = minOrder; 
                isMinApplied = true;
            }
        }

        // ==========================================
        // TIER 2: PHYSICS ENGINE (HARD COST)
        // ==========================================
        if (auditMode === 'full' || auditMode === 'cost_only') {
            const actualSqFt = (reqW * reqH) / 144;
            const totalActualSqFt = actualSqFt * qty;
            const sheetCost = is10mm ? parseFloat(config.Cost_Stock_10mm_4x8 || "33.49") : parseFloat(config.Cost_Stock_4mm_4x8 || "8.40");
            const wastePct = parseFloat(config.Waste_Factor || "1.15");
            const riskFactor = parseFloat(config.Factor_Risk || "1.05");

            const yieldX = Math.floor(48 / reqW) * Math.floor(96 / reqH);
            const yieldY = Math.floor(48 / reqH) * Math.floor(96 / reqW);
            const bestYield = Math.max(yieldX, yieldY, 1);
            const rawBlanks = (qty / bestYield) * sheetCost;

            L(`Coroplast Blanks (${thk})`, rawBlanks * wastePct, `${qty} Qty / ${bestYield} Yield * $${sheetCost.toFixed(2)}/Sht * Waste`);
            L(`Flatbed Ink`, totalActualSqFt * parseFloat(config.Cost_Ink_Latex || "0.16") * reqSides * wastePct, `Actual SF * Ink Cost * Sides * Waste`);

            if (inputs.hardware === 'H-Stakes') {
                L(`Standard H-Stakes`, qty * parseFloat(config.Cost_Stake_Std || "0.65"), `${qty}x Stakes * Cost`);
            } else if (inputs.hardware === 'HD-Stakes') {
                L(`Heavy Duty Stakes`, qty * parseFloat(config.Cost_Stake_HD || "1.85"), `${qty}x Stakes * Cost`);
            }

            totalHardCost = cst.reduce((sum, i) => sum + i.total, 0) * riskFactor;
        }

        return { 
            retail: { unitPrice: grandTotalRetail / qty, grandTotal: grandTotalRetail, breakdown: ret }, 
            cost: { total: totalHardCost, breakdown: cst }, 
            metrics: { margin: grandTotalRetail > 0 ? (grandTotalRetail - totalHardCost) / grandTotalRetail : 0 } 
        };
    });

    const finalPayload = isArray ? results : results.shift();
    return new Response(JSON.stringify(finalPayload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) { 
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders }); 
  }
});