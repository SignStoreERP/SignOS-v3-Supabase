import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export const Agent_System_Auth = {
    verifyExecutionRights: async (moduleId: string, authHeader: string) => {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // 1. Identify the Caller
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) throw new Error("[SECURITY FATAL] Unauthorized Edge Execution. Missing valid JWT.");

        const { data: staff, error: staffErr } = await supabase
            .from('staff')
            .select('id, role, department_id, first_name')
            .eq('id', user.id)
            .single();

        if (staffErr || !staff) throw new Error("[SECURITY FATAL] Staff Identity not found in Master Roster.");

        // 2. Overwatch Bypass
        if (staff.role === 'SUPER') {
            return { authorized: true, user: staff, reason: "OVERWATCH_BYPASS" };
        }

        // 3. Retrieve Module Matrix
        const { data: module, error: modErr } = await supabase
            .from('system_modules')
            .select('id, access_tags, dev_status')
            .eq('id', moduleId)
            .single();

        if (modErr || !module) throw new Error(`[SECURITY FATAL] System Module [${moduleId}] not found.`);
        
        if (module.dev_status !== 'LIVE' && module.dev_status !== 'DEV ONLY') {
            throw new Error(`[SECURITY FATAL] Module [${moduleId}] is offline or deprecated.`);
        }

        // 4. Evaluate RBAC Tag Match
        const tags = module.access_tags || [];
        const hasAccess = tags.includes(staff.role) || tags.includes(staff.department_id) || tags.includes(staff.id);

        if (!hasAccess) {
            throw new Error(`[SECURITY FATAL] Access Denied. Workforce Identity [${staff.id}] lacks required tags for [${moduleId}].`);
        }

        return { authorized: true, user: staff, reason: "MATRIX_MATCH" };
    }
};