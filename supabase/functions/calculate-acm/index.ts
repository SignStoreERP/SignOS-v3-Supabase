declare const Deno: any;
import { Agent_Flatbed_Print } from "../_shared/agents/Agent_Flatbed_Print.ts";

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
    let curves: any[] = [];

    // HEADLESS FETCH: Pull from the correct ref_retail_history table
    if ((auditMode === 'full' || auditMode === 'retail_only') && supabaseUrl && supabaseKey) {
        const [resDict, resCurves] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/ref_retail_history?select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
            fetch(`${supabaseUrl}/rest/v1/retail_curves?select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } })
        ]);
        if (resDict.ok) dictionary = await resDict.json();
        if (resCurves.ok) curves = await resCurves.json();
    }

    const results = inputPayload.map((inputs: any) => {
        const reqW = parseFloat(inputs.w) || 24;
        const reqH = parseFloat(inputs.h) || 18;
        const qty = parseFloat(inputs.qty) || 1;
        const reqSides = inputs.sides === 2 ? 2 : 1;
        const thk = String(inputs.thickness || '3mm');
        const is6mm = thk.includes('6');
        
        const ret: any[] = [];
        const cst: any[] = [];
        
        const num = (k: string) => { 
            const p = parseFloat(config[k]); 
            if (isNaN(p)) throw new Error(`Missing DB Var: [${k}]`); 
            return p; 
        };
        const V = (k: string) => `<span class="text-blue-600 font-bold" title="${k}">[${k}: ${config[k]}]</span>`;
        
        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };
        const L = (label: string, total: number, formula: string, category: string) => { if (total > 0) cst.push({label, total, formula, category}); return total; };

        let grandTotalRetail = 0;
        let totalHardCost = 0;
        let printTotal = 0;
        let routerFee = 0;

        // ==========================================
        // TIER 1: RETAIL ENGINE (Strict Dictionary)
        // ==========================================
        if (auditMode === 'full' || auditMode === 'retail_only') {
            let exactPrice = 0; 
            let mappedBox = "";
            let bestArea = Infinity; 
            let selectedRow: any = null;
            
            const targetLine = is6mm ? '6mm ACM' : '3mm ACM';
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
                        selectedRow = row;
                    }
                }
            }
            
            if (selectedRow) {
                // Correctly references legacy_price and mathematically calculates the 5% bulk break
                exactPrice = parseFloat(selectedRow.legacy_price || "0");
                if (qty >= num('Tier_1_Qty')) {
                    exactPrice = exactPrice * (1 - num('Tier_1_Disc')); 
                }
            }
            
            if (exactPrice > 0) {
                printTotal = exactPrice * qty;
                R(`Sign Print (${thk} Mapped to ${mappedBox})`, printTotal, `${qty}x Signs @ $${exactPrice.toFixed(2)}/ea`);
            } else {
                // ARCHITECTURAL FALLBACK: Dynamic Market Area Curves
                const billedW = Math.ceil(reqW / 12) * 12;
                const billedH = Math.ceil(reqH / 12) * 12;
                const billedSqFt = (billedW * billedH) / 144;
                
                let baseRate = 0;
                let minSignPrice = 0;

                const activeCurve = curves.find((c: any) => c.product_line === targetLine && billedSqFt >= c.sqft_min && billedSqFt <= c.sqft_max);
                
                if (activeCurve) {
                    baseRate = parseFloat(activeCurve.price_per_sqft || "0");
                    minSignPrice = parseFloat(activeCurve.min_price || "0");
                } else {
                    throw new Error(`Missing Retail Curve in DB for ${targetLine} at ${billedSqFt} SqFt`);
                }

                let rawUnitPrint = baseRate * billedSqFt;
                
                if (rawUnitPrint < minSignPrice) {
                    rawUnitPrint = minSignPrice;
                }

                let rawUnitDS = reqSides === 2 ? rawUnitPrint * num('Retail_Adder_DS_Mult') : 0;
                let unitPrice = rawUnitPrint + rawUnitDS;
                
                if (qty >= num('Tier_1_Qty')) unitPrice = unitPrice * (1 - num('Tier_1_Disc')); 
                printTotal = unitPrice * qty;
                
                R(`Base Print (${thk} Billed at ${billedW}"x${billedH}")`, printTotal, `${qty}x Signs (${billedSqFt} SF) @ $${baseRate}/sf`);
            }

            if (inputs.shape === 'CNC Simple') {
                routerFee = num('Retail_Fee_Router_Easy');
                R(`CNC Router Fee`, routerFee, `Simple Shape Fee`);
            } else if (inputs.shape === 'CNC Complex') {
                routerFee = num('Retail_Fee_Router_Hard');
                R(`CNC Router Fee`, routerFee, `Complex Shape Fee`);
            }
            
            let grandTotalRetailRaw = printTotal + routerFee;
            const minOrder = num('Retail_Min_Order');
            grandTotalRetail = grandTotalRetailRaw;
            let isMinApplied = false;

            if (grandTotalRetailRaw < minOrder) {
                R(`Shop Minimum Surcharge`, minOrder - grandTotalRetailRaw, `Minimum order difference`);
                grandTotalRetail = minOrder; 
                isMinApplied = true;
            }
        }

        // ==========================================
        // TIER 2: PHYSICS ENGINE (HARD COST WITH LABOR)
        // ==========================================
        if (auditMode === 'full' || auditMode === 'cost_only') {
            const actualSqFt = (reqW * reqH) / 144;
            const totalActualSqFt = actualSqFt * qty;
            const wastePct = num('Waste_Factor');
            const riskFactor = num('Factor_Risk');
            const rateOp = num('Rate_Operator');
            const rateShop = num('Rate_Shop_Labor');

            const sheetCostKey = is6mm ? 'Cost_Stock_6mm_4x8' : 'Cost_Stock_3mm_4x8';
            const sheetCost = num(sheetCostKey);
            const yieldX = Math.floor(48 / reqW) * Math.floor(96 / reqH);
            const yieldY = Math.floor(48 / reqH) * Math.floor(96 / reqW);
            const bestYield = Math.max(yieldX, yieldY, 1);
            
            L(`ACM (${thk})`, (qty / bestYield) * sheetCost * wastePct, `(${qty} Qty / ${bestYield} Yield) * ${V(sheetCostKey)}/Sht * ${V('Waste_Factor')}`, 'Materials');
            L(`Flatbed Ink`, totalActualSqFt * num('Cost_Ink_Latex') * reqSides * wastePct, `${totalActualSqFt.toFixed(1)} Actual SF * ${V('Cost_Ink_Latex')} * ${reqSides} Sides * ${V('Waste_Factor')}`, 'Materials');

            if (inputs.laminate === 'Standard') {
                L(`Gloss/Matte Laminate`, totalActualSqFt * num('Cost_Lam_SqFt') * reqSides * wastePct, `${totalActualSqFt.toFixed(1)} Actual SF * ${V('Cost_Lam_SqFt')} * ${reqSides} Sides * ${V('Waste_Factor')}`, 'Materials');
            }

            L(`Job Setup (File RIP)`, (num('Time_Setup_Job') / 60) * rateOp, `${V('Time_Setup_Job')} Mins * ${V('Rate_Operator')}/hr`, 'Labor');
            L(`Material Handling`, (num('Time_Handling') / 60) * rateShop, `${V('Time_Handling')} Mins * ${V('Rate_Shop_Labor')}/hr`, 'Labor');
            L(`Print Setup (Load Media)`, (num('Time_Setup_Printer') / 60) * rateOp, `${V('Time_Setup_Printer')} Mins * ${V('Rate_Operator')}/hr`, 'Labor');
            
            const speed = num('Machine_Speed_LF_Hr');
            const printStrat = Agent_Flatbed_Print.calculatePrintTime(reqW, reqH, qty, speed, reqSides, 60);
            
            L(`Flatbed Operator (Attn)`, printStrat.printHrs * rateOp * num('Labor_Attendance_Ratio'), `${printStrat.logic} -> ${printStrat.printHrs.toFixed(2)} Hrs * ${V('Rate_Operator')}/hr * ${V('Labor_Attendance_Ratio')}`, 'Labor');
            L(`Flatbed Machine Run`, printStrat.printHrs * num('Rate_Machine_Flatbed'), `${printStrat.printHrs.toFixed(2)} Hrs * ${V('Rate_Machine_Flatbed')}/hr`, 'Labor');

            if (inputs.laminate === 'Standard') {
                const lamHrs = (totalActualSqFt / num('Speed_Lam_Roll')) * reqSides;
                L(`Lamination Run`, lamHrs * rateShop, `${totalActualSqFt.toFixed(1)} SF / ${V('Speed_Lam_Roll')} SF/hr * ${V('Rate_Shop_Labor')}/hr`, 'Labor');
            }

            if (inputs.shape === 'CNC Simple' || inputs.shape === 'CNC Complex') {
                const cncTimeKey = inputs.shape === 'CNC Simple' ? 'Time_CNC_Easy_SqFt' : 'Time_CNC_Complex_SqFt';
                const cncTime = num(cncTimeKey);
                const cutHrs = (totalActualSqFt * cncTime) / 60;
                L(`CNC Router Setup`, (num('Time_Setup_CNC') / 60) * num('Rate_CNC_Labor'), `${V('Time_Setup_CNC')} Mins * ${V('Rate_CNC_Labor')}/hr`, 'Labor');
                L(`CNC Router Run`, cutHrs * num('Rate_Machine_CNC'), `${cutHrs.toFixed(2)} Hrs * ${V('Rate_Machine_CNC')}/hr`, 'Labor');
            } else {
                let cutsPerEa = 2;
                if ((reqW === 48 && reqH === 96) || (reqW === 96 && reqH === 48) || (reqW === 60 && reqH === 120) || (reqW === 120 && reqH === 60)) cutsPerEa = 0; 
                else if (reqW === 48 || reqH === 48 || reqW === 96 || reqH === 96 || reqW === 60 || reqH === 60 || reqW === 120 || reqH === 120) cutsPerEa = 1; 

                L(`Shear/Saw Setup`, (num('Time_Shear_Setup') / 60) * rateShop, `${V('Time_Shear_Setup')} Mins * ${V('Rate_Shop_Labor')}/hr`, 'Labor');
                
                if (cutsPerEa > 0) {
                    L(`Shear/Saw Run (${cutsPerEa} Cuts/Ea)`, ((qty * cutsPerEa * num('Time_Shear_Cut')) / 60) * rateShop, `${qty} Qty * ${cutsPerEa} Cuts * ${V('Time_Shear_Cut')} Min/Cut * ${V('Rate_Shop_Labor')}/hr`, 'Labor');
                }

                L(`Corner Rounding Setup`, (num('Time_Round_Setup') / 60) * rateShop, `${V('Time_Round_Setup')} Mins * ${V('Rate_Shop_Labor')}/hr`, 'Labor');
                L(`Corner Rounding Run`, ((qty * 4 * num('Time_Round_Corner')) / 60) * rateShop, `${qty} Qty * 4 Corners * ${V('Time_Round_Corner')} Min/Cnr * ${V('Rate_Shop_Labor')}/hr`, 'Labor');
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