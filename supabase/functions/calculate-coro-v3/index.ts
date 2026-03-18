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
        
        const num = (k: string) => { 
            const p = parseFloat(config[k]); 
            if (isNaN(p)) throw new Error(`Missing DB Var: [${k}]`); 
            return p; 
        };
        const V = (k: string) => `<span class="text-blue-600 font-bold" title="${k}">[${k}: ${config[k]}]</span>`;
        
        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };
        // NOTE: If a calculation returns 0, it is intentionally excluded from the ledger.
        const L = (label: string, total: number, formula: string, category: string) => { if (total > 0) cst.push({label, total, formula, category}); return total; };

        let grandTotalRetail = 0;
        let totalHardCost = 0;
        let printTotal = 0;
        let routerFee = 0;
        let stakeTotal = 0;

        // ==========================================
        // TIER 1: RETAIL ENGINE (Strict Dictionary)
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
                if (qty >= num('Tier_1_Qty')) unitPrice = unitPrice * (1 - num('Tier_1_Disc')); 
                printTotal = unitPrice * qty;
                R(`Sign Print (${thk} Rounded to ${mappedBox})`, printTotal, `${qty}x Signs @ $${unitPrice.toFixed(2)}/ea`);
            } else {
                
                const billedW = Math.ceil(reqW / 12) * 12;
                const billedH = Math.ceil(reqH / 12) * 12;
                const billedSqFt = (billedW * billedH) / 144;
                
                let baseRate = 0;
                let minSignPrice = 0;

                if (is10mm) {
                    if (billedSqFt < 4) { baseRate = num('COR10_T1_Rate'); minSignPrice = num('COR10_T1_Min'); }
                    else if (billedSqFt < 16) baseRate = num('COR10_T2_Rate');
                    else if (billedSqFt < 32) baseRate = num('COR10_T3_Rate');
                    else baseRate = num('COR10_T4_Rate');
                } else {
                    if (billedSqFt < 4) { baseRate = num('COR4_T1_Rate'); minSignPrice = num('COR4_T1_Min'); }
                    else if (billedSqFt < 16) baseRate = num('COR4_T2_Rate');
                    else if (billedSqFt < 32) baseRate = num('COR4_T3_Rate');
                    else baseRate = num('COR4_T4_Rate');
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

            if (inputs.hardware === 'H-Stakes') {
                const stkRate = num('Retail_Stake_Std');
                stakeTotal = stkRate * qty;
                R(`Standard H-Stakes`, stakeTotal, `${qty}x Stakes @ $${stkRate.toFixed(2)}/ea`);
            } else if (inputs.hardware === 'HD-Stakes') {
                const stkRate = num('Retail_Stake_HD');
                stakeTotal = stkRate * qty;
                R(`Heavy Duty Stakes`, stakeTotal, `${qty}x Stakes @ $${stkRate.toFixed(2)}/ea`);
            }
            
            let grandTotalRetailRaw = printTotal + routerFee + stakeTotal;
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

            // 1. Materials & Blank Bypass
            const isStandardBlank = (reqW === 24 && reqH === 18) || (reqW === 18 && reqH === 24);
            const is4mmBlank = thk === '4mm' && isStandardBlank;

            if (is4mmBlank) {
                const blankCost = num('Cost_Blank_Standard');
                L(`Precut Coro Blanks (24x18)`, qty * blankCost * wastePct, `Bypass Yield: ${qty} Blanks * ${V('Cost_Blank_Standard')}/Ea * ${V('Waste_Factor')}`, 'Materials');
            } else {
                const sheetCostKey = is10mm ? 'Cost_Stock_10mm_4x8' : 'Cost_Stock_4mm_4x8';
                const sheetCost = num(sheetCostKey);
                const yieldX = Math.floor(48 / reqW) * Math.floor(96 / reqH);
                const yieldY = Math.floor(48 / reqH) * Math.floor(96 / reqW);
                const bestYield = Math.max(yieldX, yieldY, 1);
                
                L(`Coroplast (${thk})`, (qty / bestYield) * sheetCost * wastePct, `(${qty} Qty / ${bestYield} Yield) * ${V(sheetCostKey)}/Sht * ${V('Waste_Factor')}`, 'Materials');
            }

            // 2. Hardware
            if (inputs.hardware === 'H-Stakes') {
                L(`Standard H-Stakes`, qty * num('Cost_Stake_Std'), `${qty}x Stakes * ${V('Cost_Stake_Std')}`, 'Hardware');
            } else if (inputs.hardware === 'HD-Stakes') {
                L(`Heavy Duty Stakes`, qty * num('Cost_Stake_HD'), `${qty}x Stakes * ${V('Cost_Stake_HD')}`, 'Hardware');
            }

            // 3. Labor & Machine Pathing (Bifurcated Workflow)
            L(`Job Setup (File RIP)`, (num('Time_Setup_Job') / 60) * rateOp, `${V('Time_Setup_Job')} Mins * ${V('Rate_Operator')}/hr`, 'Labor');
            
            if (is10mm) {
                // 10mm Workflow: Printed Vinyl + Laminate + Mounting
                L(`Vinyl Media`, totalActualSqFt * num('Cost_Vin_Cal') * reqSides * wastePct, `${totalActualSqFt.toFixed(1)} Actual SF * ${V('Cost_Vin_Cal')} * ${reqSides} Sides * ${V('Waste_Factor')}`, 'Materials');
                L(`Laminate Media`, totalActualSqFt * num('Cost_Lam_Cal') * reqSides * wastePct, `${totalActualSqFt.toFixed(1)} Actual SF * ${V('Cost_Lam_Cal')} * ${reqSides} Sides * ${V('Waste_Factor')}`, 'Materials');
                L(`Latex Ink`, totalActualSqFt * num('Cost_Ink_Latex') * reqSides * wastePct, `${totalActualSqFt.toFixed(1)} Actual SF * ${V('Cost_Ink_Latex')} * ${reqSides} Sides * ${V('Waste_Factor')}`, 'Materials');

                L(`Print Setup (Roll Media)`, (num('Time_Setup_Printer') / 60) * rateOp, `${V('Time_Setup_Printer')} Mins * ${V('Rate_Operator')}/hr`, 'Labor');
                
                const printHrs = (totalActualSqFt / num('Speed_Print_Roll')) * reqSides;
                
                // Attendance Ratio evaluates to 0 and auto-hides from the ledger natively
                L(`Roll Printer Operator (Attn)`, printHrs * rateOp * num('Labor_Attendance_Ratio'), `${totalActualSqFt.toFixed(1)} SF / ${V('Speed_Print_Roll')} SF/hr * ${reqSides} Sides * ${V('Rate_Operator')}/hr * ${V('Labor_Attendance_Ratio')}`, 'Labor');
                L(`Roll Printer Machine Run`, printHrs * num('Rate_Machine_Print'), `${printHrs.toFixed(2)} Hrs * ${V('Rate_Machine_Print')}/hr`, 'Labor');

                const lamHrs = (totalActualSqFt / num('Speed_Lam_Roll')) * reqSides;
                L(`Lamination Run`, lamHrs * rateShop, `${totalActualSqFt.toFixed(1)} SF / ${V('Speed_Lam_Roll')} SF/hr * ${reqSides} Sides * ${V('Rate_Shop_Labor')}/hr`, 'Labor');

                // Mount Time globally pulls the Laminator feed rate (0.20 mins/sqft)
                const mountMins = totalActualSqFt * num('Time_Mount_Flat_SqFt') * reqSides;
                L(`Mount Vinyl to Substrate`, (mountMins / 60) * rateShop, `${totalActualSqFt.toFixed(1)} SF * ${V('Time_Mount_Flat_SqFt')} Mins/SF * ${reqSides} Sides * ${V('Rate_Shop_Labor')}/hr`, 'Labor');
            } else {
                // 4mm Workflow: Direct Flatbed Print
                L(`Flatbed Ink`, totalActualSqFt * num('Cost_Ink_Latex') * reqSides * wastePct, `${totalActualSqFt.toFixed(1)} Actual SF * ${V('Cost_Ink_Latex')} * ${reqSides} Sides * ${V('Waste_Factor')}`, 'Materials');
                L(`Print Setup (Load Media)`, (num('Time_Setup_Printer') / 60) * rateOp, `${V('Time_Setup_Printer')} Mins * ${V('Rate_Operator')}/hr`, 'Labor');
                
                const speed = num('Machine_Speed_LF_Hr');
                const printStrat = Agent_Flatbed_Print.calculatePrintTime(reqW, reqH, qty, speed, reqSides, 60);
                
                // Attendance Ratio evaluates to 0 and auto-hides from the ledger natively
                L(`Flatbed Operator (Attn)`, printStrat.printHrs * rateOp * num('Labor_Attendance_Ratio'), `${printStrat.logic} -> ${printStrat.printHrs.toFixed(2)} Hrs * ${V('Rate_Operator')}/hr * ${V('Labor_Attendance_Ratio')}`, 'Labor');
                L(`Flatbed Machine Run`, printStrat.printHrs * num('Rate_Machine_Flatbed'), `${printStrat.printHrs.toFixed(2)} Hrs * ${V('Rate_Machine_Flatbed')}/hr`, 'Labor');
            }

            // 4. Finishing / Routing
            if (inputs.shape === 'CNC Simple' || inputs.shape === 'CNC Complex') {
                const cncTimeKey = inputs.shape === 'CNC Simple' ? 'Time_CNC_Easy_SqFt' : 'Time_CNC_Complex_SqFt';
                const cncTime = num(cncTimeKey);
                const cutHrs = (totalActualSqFt * cncTime) / 60;
                L(`CNC Router Setup`, (num('Time_Setup_CNC') / 60) * num('Rate_CNC_Labor'), `${V('Time_Setup_CNC')} Mins * ${V('Rate_CNC_Labor')}/hr`, 'Labor');
                L(`CNC Router Run`, cutHrs * num('Rate_Machine_CNC'), `${cutHrs.toFixed(2)} Hrs * ${V('Rate_Machine_CNC')}/hr`, 'Labor');
            } else if (!is4mmBlank) {
                // Dynamic Edge Logic: Evaluates parent sheet borders
                let cutsPerEa = 2;
                if ((reqW === 48 && reqH === 96) || (reqW === 96 && reqH === 48)) cutsPerEa = 0; // Full Sheet
                else if (reqW === 48 || reqH === 48 || reqW === 96 || reqH === 96) cutsPerEa = 1; // Shares one parent dimension

                L(`Hand Cutting Setup`, (num('Time_Hand_Cut_Setup') / 60) * rateShop, `${V('Time_Hand_Cut_Setup')} Mins (Ruler/Razor) * ${V('Rate_Shop_Labor')}/hr`, 'Labor');
                
                if (cutsPerEa > 0) {
                    L(`Hand Cutting Run (${cutsPerEa} Cuts/Ea)`, ((qty * cutsPerEa * num('Time_Hand_Cut_Ea')) / 60) * rateShop, `${qty} Qty * ${cutsPerEa} Cuts * ${V('Time_Hand_Cut_Ea')} Min/Cut * ${V('Rate_Shop_Labor')}/hr`, 'Labor');
                }
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