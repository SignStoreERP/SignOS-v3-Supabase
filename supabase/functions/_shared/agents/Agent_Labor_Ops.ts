import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export const Agent_Labor_Ops = {
    // 1. SECURE DATABASE FETCHER
    fetchLaborRate: async (roleId: string, authHeader: string) => {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: role, error } = await supabase
            .from('labor_rates')
            .select('id, department_id, role_name, cost_hourly, retail_hourly')
            .eq('id', roleId)
            .single();

        if (error || !role) {
            throw new Error(`[NO FALLBACK MANDATE] Labor Role [${roleId}] not found in database. Calculation halted.`);
        }

        if (!role.cost_hourly || role.cost_hourly <= 0) {
            throw new Error(`[NO FALLBACK MANDATE] Zero or missing hourly cost for Role [${roleId}]. Cost drift prevented.`);
        }

        return role;
    },

    // 2. LABOR PHYSICS MATH
    calculateLaborCost: (minutes: number, rateData: any) => {
        const hours = minutes / 60;
        const rateCost = parseFloat(rateData.cost_hourly);
        const rateRetail = parseFloat(rateData.retail_hourly) || rateCost; // Retail default buffer
        
        return {
            taskMinutes: minutes,
            taskHours: hours,
            costRateHr: rateCost,
            totalHardCost: hours * rateCost,
            retailRateHr: rateRetail,
            totalRetailValue: hours * rateRetail
        };
    }
};