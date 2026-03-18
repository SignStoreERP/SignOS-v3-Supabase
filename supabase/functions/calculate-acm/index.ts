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
        const reqH = parseFloat(inputs.h) || 18;
        const qty = parseFloat(inputs.qty) || 1;
        const reqSides = inputs.sides === 2 ? 2 : 1;
        const thk = String(inputs.thickness || '3mm');
        const is6mm = thk.includes('6');
        
        const ret: any[] = [];
        const cst: any[] = [];
        
        const num = (val: any, fallback: string) => { const p = parseFloat(val); return isNaN(p) ? parseFloat(fallback) : p; };
        const V = (k: string, fb: string) => `<span class="text-blue-600 font-bold" title="${k}">[${k}: ${num(config[k], fb)}]</span>`;
        
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
                const baseRate = is6mm ? num(config.ACM6_T4_Rate, "16") : num(config.ACM3_T4_Rate, "12");
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
            
            let grandTotalRetailRaw = printTotal + routerFee;
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

            // 1. Materials
            const sheetCostKey = is6mm ? 'Cost_Stock_6mm_4x8' : 'Cost_Stock_3mm_4x8';
            const sheetCost = num(config[sheetCostKey], is6mm ? "72.10" : "52.09");
            const yieldX = Math.floor(48 / reqW) * Math.floor(96 / reqH);
            const yieldY = Math.floor(48 / reqH) * Math.floor(96 / reqW);
            const bestYield = Math.max(yieldX, yieldY, 1);
            
            L(`ACM Blanks (${thk})`, (qty / bestYield) * sheetCost * wastePct, `(${qty} Qty / ${bestYield} Yield) * ${V(sheetCostKey, is6mm ? "72.10" : "52.09")}/Sht * ${V('Waste_Factor', "1.15")}`, 'Materials');
            L(`Flatbed Ink`, totalActualSqFt * num(config.Cost_Ink_Latex, "0.16") * reqSides * wastePct, `${totalActualSqFt.toFixed(1)} Actual SF * ${V('Cost_Ink_Latex', "0.16")} * ${reqSides} Sides * ${V('Waste_Factor', "1.15")}`, 'Materials');

            if (inputs.laminate === 'Standard') {
                L(`Gloss/Matte Laminate`, totalActualSqFt * num(config.Cost_Lam_SqFt, "0.36") * reqSides * wastePct, `${totalActualSqFt.toFixed(1)} Actual SF * ${V('Cost_Lam_SqFt', "0.36")} * ${reqSides} Sides * ${V('Waste_Factor', "1.15")}`, 'Materials');
            }

            // 2. Labor (SHARED AGENT HANDOFF)
            L(`Print Setup (Load Media)`, (num(config.Time_Setup_Printer, "5") / 60) * rateOp, `${V('Time_Setup_Printer', "5")} Mins * ${V('Rate_Operator', "25")}/hr`, 'Labor');
            
            const speed = num(config.Machine_Speed_LF_Hr, "25");
            const printStrat = Agent_Flatbed_Print.calculatePrintTime(reqW, reqH, qty, speed, reqSides, 60);
            
            L(`Flatbed Operator (Attn)`, printStrat.printHrs * rateOp * num(config.Labor_Attendance_Ratio, "0.10"), `${printStrat.logic} -> ${printStrat.printHrs.toFixed(2)} Hrs * ${V('Rate_Operator', "25")}/hr * ${V('Labor_Attendance_Ratio', "0.10")}`, 'Labor');
            L(`Flatbed Machine Run`, printStrat.printHrs * num(config.Rate_Machine_Flatbed, "10"), `${printStrat.printHrs.toFixed(2)} Hrs * ${V('Rate_Machine_Flatbed', "10")}/hr`, 'Labor');

            if (inputs.laminate === 'Standard') {
                const lamHrs = (totalActualSqFt / num(config.Speed_Lam_Roll, "300")) * reqSides;
                L(`Lamination Run`, lamHrs * rateShop, `${totalActualSqFt.toFixed(1)} SF / ${V('Speed_Lam_Roll', "300")} SF/hr * ${V('Rate_Shop_Labor', "20")}/hr`, 'Labor');
            }

            // 3. Finishing / Routing
            if (inputs.shape === 'CNC Simple' || inputs.shape === 'CNC Complex') {
                const cncTimeKey = inputs.shape === 'CNC Simple' ? 'Time_CNC_Easy_SqFt' : 'Time_CNC_Complex_SqFt';
                const cncTimeFb = inputs.shape === 'CNC Simple' ? "1" : "2";
                const cncTime = num(config[cncTimeKey], cncTimeFb);
                const cutHrs = (totalActualSqFt * cncTime) / 60;
                L(`CNC Router Setup`, (num(config.Time_Setup_CNC, "10") / 60) * num(config.Rate_CNC_Labor, "25"), `${V('Time_Setup_CNC', "10")} Mins * ${V('Rate_CNC_Labor', "25")}/hr`, 'Labor');
                L(`CNC Router Run`, cutHrs * num(config.Rate_Machine_CNC, "10"), `${cutHrs.toFixed(2)} Hrs * ${V('Rate_Machine_CNC', "10")}/hr`, 'Labor');
            } else {
                L(`Shear/Saw Setup`, (num(config.Time_Shear_Setup, "5") / 60) * rateShop, `${V('Time_Shear_Setup', "5")} Mins * ${V('Rate_Shop_Labor', "20")}/hr`, 'Labor');
                L(`Shear/Saw Run`, ((qty * 2 * num(config.Time_Shear_Cut, "1")) / 60) * rateShop, `${qty} Qty * 2 Cuts * ${V('Time_Shear_Cut', "1")} Min/Cut * ${V('Rate_Shop_Labor', "20")}/hr`, 'Labor');
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