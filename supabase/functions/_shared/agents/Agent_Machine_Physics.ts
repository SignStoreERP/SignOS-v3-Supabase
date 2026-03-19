import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export const Agent_Machine_Physics = {
    fetchMachine: async (machineId: string, authHeader: string) => {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: machine, error } = await supabase
            .from('machines')
            .select('id, name, type, overhead_rate_hr, ink_cost_sqft')
            .eq('id', machineId)
            .single();

        if (error || !machine) {
            throw new Error(`[NO FALLBACK MANDATE] Machine ID [${machineId}] not found in database.`);
        }

        return machine;
    },

    calculateMachineRun: (minutes: number, machineData: any) => {
        const hours = minutes / 60;
        const overheadRate = parseFloat(machineData.overhead_rate_hr) || 0;
        
        if (overheadRate <= 0) {
            throw new Error(`[NO FALLBACK MANDATE] Missing overhead rate for Machine [${machineData.id}].`);
        }

        return {
            runMinutes: minutes,
            runHours: hours,
            overheadRateHr: overheadRate,
            totalOverheadCost: hours * overheadRate
        };
    },

    calculateInkDepletion: (totalSqFt: number, machineData: any) => {
        const inkCostSqFt = parseFloat(machineData.ink_cost_sqft) || 0;
        
        return {
            sqftRendered: totalSqFt,
            inkCostPerSqFt: inkCostSqFt,
            totalInkCost: totalSqFt * inkCostSqFt
        };
    }
};