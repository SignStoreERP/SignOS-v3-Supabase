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
        
        // UTILITIES: Safe numerical parsing and formula string injection
        const num = (val: any, fallback: string) => { const p = parseFloat(val); return isNaN(p) ? parseFloat(fallback) : p; };
        const V = (k: string, fb: string) => `<span class="text-blue-600 font-bold" title="${k}">[${k}: ${num(config[k], fb)}]</span>`;
        
        const R = (label: string, total: number, formula: string) => { if (total > 0) ret.push({label, total, formula}); return total; };
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
                if (qty >= 10) unitPrice = unitPrice * 0.95; 
                printTotal = unitPrice * qty;
                R(`Sign Print (${thk} Rounded to ${mappedBox})`, printTotal, `${qty}x Signs @ $${unitPrice.toFixed(2)}/ea`);
            } else {
                const billedSqFt = (Math.ceil(reqW / 12) * Math.ceil(reqH / 12));
                const baseRate = is10mm ? num(config.COR10_T4_Rate, "15") : num(config.COR4_T4_Rate, "5");
                let rawUnitPrint = baseRate * billedSqFt;
                let rawUnitDS = reqSides === 2 ? rawUnitPrint * num(config.Retail_Adder_DS_Mult, "0.5") : 0;
                printTotal = (rawUnitPrint + rawUnitDS) * qty;
                R(`Oversized Print (${billedSqFt} SF)`, printTotal, `Area Fallback Math`);
            }

            if (inputs.shape === 'CNC Simple') {
                routerFee = num(config.Retail_Fee_Router_Easy, "30");
                R(`CNC Router Fee`, routerFee, `Simple Shape Fee`);
            } else if (inputs.shape === 'CNC Complex') {
                routerFee = num(config.Retail_Fee_Router_Hard, "50");
                R(`CNC Router Fee`, routerFee, `Complex Shape Fee`);
            }

            if (inputs.hardware === 'H-Stakes') {
                const stkRate = num(config.Retail_Stake_Std, "2.50");
                stakeTotal = stkRate * qty;
                R(`Standard H-Stakes`, stakeTotal, `${qty}x Stakes @ $${stkRate.toFixed(2)}/ea`);
            } else if (inputs.hardware === 'HD-Stakes') {
                const stkRate = num(config.Retail_Stake_HD, "4.00");
                stakeTotal = stkRate * qty;
                R(`Heavy Duty Stakes`, stakeTotal, `${qty}x Stakes @ $${stkRate.toFixed(2)}/ea`);
            }
            
            let grandTotalRetailRaw = printTotal + routerFee + stakeTotal;
            const minOrder = num(config.Retail_Min_Order, "50");
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
            const wastePct = num(config.Waste_Factor, "1.15");
            const riskFactor = num(config.Factor_Risk, "1.05");
            const rateOp = num(config.Rate_Operator, "25");
            const rateShop = num(config.Rate_Shop_Labor, "20");

            // 1. Materials & Blank Bypass Logic
            const isStandardBlank = (reqW === 24 && reqH === 18) || (reqW === 18 && reqH === 24);
            const is4mmBlank = thk === '4mm' && isStandardBlank;

            if (is4mmBlank) {
                const blankCost = num(config.Cost_Blank_Standard, "0.65");
                L(`Precut Coro Blanks (24x18)`, qty * blankCost * wastePct, `Bypass Yield: ${qty} Blanks * ${V('Cost_Blank_Standard', "0.65")}/Ea * ${V('Waste_Factor', "1.15")}`, 'Materials');
            } else {
                const sheetCostKey = is10mm ? 'Cost_Stock_10mm_4x8' : 'Cost_Stock_4mm_4x8';
                const sheetCost = num(config[sheetCostKey], is10mm ? "33.49" : "8.40");
                const yieldX = Math.floor(48 / reqW) * Math.floor(96 / reqH);
                const yieldY = Math.floor(48 / reqH) * Math.floor(96 / reqW);
                const bestYield = Math.max(yieldX, yieldY, 1);
                L(`Coroplast Blanks (${thk})`, (qty / bestYield) * sheetCost * wastePct, `(${qty} Qty / ${bestYield} Yield) * ${V(sheetCostKey, is10mm ? "33.49" : "8.40")}/Sht * ${V('Waste_Factor', "1.15")}`, 'Materials');
            }

            L(`Flatbed Ink`, totalActualSqFt * num(config.Cost_Ink_Latex, "0.16") * reqSides * wastePct, `${totalActualSqFt.toFixed(1)} Actual SF * ${V('Cost_Ink_Latex', "0.16")} * ${reqSides} Sides * ${V('Waste_Factor', "1.15")}`, 'Materials');

            // 2. Hardware
            if (inputs.hardware === 'H-Stakes') {
                L(`Standard H-Stakes`, qty * num(config.Cost_Stake_Std, "0.65"), `${qty}x Stakes * ${V('Cost_Stake_Std', "0.65")}`, 'Hardware');
            } else if (inputs.hardware === 'HD-Stakes') {
                L(`Heavy Duty Stakes`, qty * num(config.Cost_Stake_HD, "1.85"), `${qty}x Stakes * ${V('Cost_Stake_HD', "1.85")}`, 'Hardware');
            }

            // 3. Labor (SHARED AGENT HANDOFF)
            L(`Print Setup (Load Media)`, (num(config.Time_Setup_Printer, "5") / 60) * rateOp, `${V('Time_Setup_Printer', "5")} Mins * ${V('Rate_Operator', "25")}/hr`, 'Labor');
            
            const speed = num(config.Machine_Speed_LF_Hr, "25");
            const printStrat = Agent_Flatbed_Print.calculatePrintTime(reqW, reqH, qty, speed, reqSides, 60);
            
            L(`Flatbed Operator (Attn)`, printStrat.printHrs * rateOp * num(config.Labor_Attendance_Ratio, "0.10"), `${printStrat.logic} -> ${printStrat.printHrs.toFixed(2)} Hrs * ${V('Rate_Operator', "25")}/hr * ${V('Labor_Attendance_Ratio', "0.10")}`, 'Labor');
            L(`Flatbed Machine Run`, printStrat.printHrs * num(config.Rate_Machine_Flatbed, "10"), `${printStrat.printHrs.toFixed(2)} Hrs * ${V('Rate_Machine_Flatbed', "10")}/hr`, 'Labor');

            // 4. Finishing / Routing
            if (inputs.shape === 'CNC Simple' || inputs.shape === 'CNC Complex') {
                const cncTimeKey = inputs.shape === 'CNC Simple' ? 'Time_CNC_Easy_SqFt' : 'Time_CNC_Complex_SqFt';
                const cncTimeFb = inputs.shape === 'CNC Simple' ? "1" : "2";
                const cncTime = num(config[cncTimeKey], cncTimeFb);
                const cutHrs = (totalActualSqFt * cncTime) / 60;
                L(`CNC Router Setup`, (num(config.Time_Setup_CNC, "10") / 60) * num(config.Rate_CNC_Labor, "25"), `${V('Time_Setup_CNC', "10")} Mins * ${V('Rate_CNC_Labor', "25")}/hr`, 'Labor');
                L(`CNC Router Run`, cutHrs * num(config.Rate_Machine_CNC, "10"), `${cutHrs.toFixed(2)} Hrs * ${V('Rate_Machine_CNC', "10")}/hr`, 'Labor');
            } else if (!is4mmBlank) {
                // Hand Cutting Engine (2-Cuts per piece bypassing Shear)
                L(`Hand Cutting Setup`, (5 / 60) * rateShop, `5 Mins (Ruler/Razor) * ${V('Rate_Shop_Labor', "20")}/hr`, 'Labor');
                L(`Hand Cutting Run (2 Cuts/Ea)`, ((qty * 2 * 1) / 60) * rateShop, `${qty} Qty * 2 Cuts * 1 Min/Cut * ${V('Rate_Shop_Labor', "20")}/hr`, 'Labor');
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