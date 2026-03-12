drop extension if exists "pg_net";

create type "public"."material_category" as enum ('Rigid', 'Roll', 'Hardware', 'Metals', 'ADA', 'Channel');

create type "public"."staff_role" as enum ('SALES', 'PROD', 'ADMIN', 'SUPER');

create sequence "public"."ref_colors_paint_id_seq";

create sequence "public"."ref_fonts_id_seq";


  create table "public"."access_logs" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "ip_address" character varying(45),
    "user_name" character varying(100),
    "role" character varying(50),
    "action" character varying(100),
    "target" character varying(255),
    "meta_data" jsonb
      );



  create table "public"."departments" (
    "id" character varying(50) not null,
    "name" character varying(255) not null,
    "category" character varying(100)
      );



  create table "public"."global_variables" (
    "id" character varying(50) not null,
    "category" character varying(50) not null,
    "unit" character varying(50),
    "logic_type" character varying(50),
    "default_value" numeric(12,4) not null,
    "notes" text
      );



  create table "public"."labor_rates" (
    "id" character varying(50) not null,
    "department_id" character varying(50),
    "role_name" character varying(255) not null,
    "cost_hourly" numeric(10,2) not null default 0.00,
    "retail_hourly" numeric(10,2) not null default 0.00
      );



  create table "public"."machines" (
    "id" character varying(50) not null,
    "name" character varying(100) not null,
    "type" character varying(100),
    "overhead_rate_hr" numeric(10,2) default 0.00,
    "ink_cost_sqft" numeric(10,4) default 0.00
      );



  create table "public"."material_costs_history" (
    "id" uuid not null default gen_random_uuid(),
    "sku" character varying(100),
    "internal_cost" numeric(12,4) not null,
    "retail_ref" numeric(12,4),
    "effective_from" timestamp with time zone default now(),
    "effective_to" timestamp with time zone
      );



  create table "public"."materials" (
    "sku" character varying(100) not null,
    "category" public.material_category not null,
    "uom" character varying(50) not null,
    "description" text,
    "waste_factor" numeric(5,2) default 1.00,
    "supplier" character varying(255)
      );



  create table "public"."product_configurations" (
    "id" character varying(50) not null,
    "display_name" character varying(100) not null,
    "matrix_overrides" jsonb default '{}'::jsonb,
    "required_skus" jsonb default '[]'::jsonb,
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."production_tasks" (
    "id" character varying(50) not null,
    "description" text not null,
    "workstation_id" character varying(50),
    "labor_role_id" character varying(50),
    "std_time" numeric(10,4) not null,
    "uom" character varying(50) not null
      );



  create table "public"."ref_colors_paint" (
    "id" integer not null default nextval('public.ref_colors_paint_id_seq'::regclass),
    "brand" character varying(20) not null,
    "code" character varying(50) not null,
    "name" character varying(100) not null,
    "hex_code" character varying(20) not null
      );



  create table "public"."ref_fonts" (
    "id" integer not null default nextval('public.ref_fonts_id_seq'::regclass),
    "font_name" character varying(100) not null,
    "css_family" character varying(100) not null,
    "file_name" character varying(100) not null,
    "is_active" boolean default true
      );



  create table "public"."ref_pictograms" (
    "item_code" character varying(50) not null,
    "category" character varying(100),
    "name" character varying(150) not null,
    "viewbox" character varying(50),
    "svg_path" text not null,
    "is_active" boolean default true,
    "notes" text
      );



  create table "public"."retail_curves" (
    "id" character varying(50) not null,
    "product_line" character varying(100) not null,
    "condition" character varying(100),
    "sqft_min" numeric(10,2) default 0.00,
    "sqft_max" numeric(10,2) default 999.00,
    "price_per_sqft" numeric(10,2) not null,
    "min_price" numeric(10,2) default 0.00
      );



  create table "public"."retail_fixed_prices" (
    "id" character varying(50) not null,
    "category" character varying(100) not null,
    "product_line" character varying(100) not null,
    "dimensions" character varying(50),
    "sides" character varying(20),
    "uom" character varying(50) default 'Unit'::character varying,
    "price_qty_1" numeric(10,2) not null,
    "price_qty_10" numeric(10,2)
      );



  create table "public"."services" (
    "sku" character varying(50) not null,
    "description" text not null,
    "uom" character varying(50) not null,
    "cost_basis" numeric(10,2) default 0.00,
    "retail_ref" numeric(10,2) not null
      );



  create table "public"."staff" (
    "id" uuid not null,
    "department_id" character varying(50),
    "first_name" character varying(100) not null,
    "last_name" character varying(100) not null,
    "title" character varying(150),
    "email" character varying(255) not null,
    "role" public.staff_role default 'SALES'::public.staff_role,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."system_modules" (
    "id" character varying(50) not null,
    "display_name" character varying(100) not null,
    "file_link" character varying(255),
    "dev_status" character varying(50),
    "live_ver" character varying(20),
    "dev_ver" character varying(20),
    "live_sales" boolean default false,
    "live_prod" boolean default false,
    "live_admin" boolean default false,
    "dev_sales" boolean default false,
    "dev_prod" boolean default false,
    "dev_admin" boolean default false,
    "category" character varying(50),
    "icon" character varying(50),
    "icon_path" text
      );



  create table "public"."ticket_actions" (
    "id" character varying(50) not null,
    "ticket_id" character varying(50),
    "created_at" timestamp with time zone default now(),
    "user_id" uuid,
    "action_type" character varying(50),
    "details" text
      );



  create table "public"."tickets" (
    "id" character varying(50) not null,
    "created_at" timestamp with time zone default now(),
    "user_id" uuid,
    "category" character varying(50),
    "priority" character varying(20) default 'Med'::character varying,
    "title" character varying(255) not null,
    "description" text,
    "status" character varying(50) default 'Pending'::character varying,
    "target_env" character varying(20) default 'APP'::character varying,
    "source" character varying(50),
    "context" character varying(100)
      );



  create table "public"."workstations" (
    "id" character varying(50) not null,
    "department_id" character varying(50),
    "name" character varying(100) not null,
    "equipment_linked" character varying(100)
      );


alter sequence "public"."ref_colors_paint_id_seq" owned by "public"."ref_colors_paint"."id";

alter sequence "public"."ref_fonts_id_seq" owned by "public"."ref_fonts"."id";

CREATE UNIQUE INDEX access_logs_pkey ON public.access_logs USING btree (id);

CREATE UNIQUE INDEX departments_pkey ON public.departments USING btree (id);

CREATE UNIQUE INDEX global_variables_pkey ON public.global_variables USING btree (id);

CREATE UNIQUE INDEX labor_rates_pkey ON public.labor_rates USING btree (id);

CREATE UNIQUE INDEX machines_pkey ON public.machines USING btree (id);

CREATE UNIQUE INDEX material_costs_history_pkey ON public.material_costs_history USING btree (id);

CREATE UNIQUE INDEX materials_pkey ON public.materials USING btree (sku);

CREATE UNIQUE INDEX product_configurations_pkey ON public.product_configurations USING btree (id);

CREATE UNIQUE INDEX production_tasks_pkey ON public.production_tasks USING btree (id);

CREATE UNIQUE INDEX ref_colors_paint_pkey ON public.ref_colors_paint USING btree (id);

CREATE UNIQUE INDEX ref_fonts_pkey ON public.ref_fonts USING btree (id);

CREATE UNIQUE INDEX ref_pictograms_pkey ON public.ref_pictograms USING btree (item_code);

CREATE UNIQUE INDEX retail_curves_pkey ON public.retail_curves USING btree (id);

CREATE UNIQUE INDEX retail_fixed_prices_pkey ON public.retail_fixed_prices USING btree (id);

CREATE UNIQUE INDEX services_pkey ON public.services USING btree (sku);

CREATE UNIQUE INDEX staff_email_key ON public.staff USING btree (email);

CREATE UNIQUE INDEX staff_pkey ON public.staff USING btree (id);

CREATE UNIQUE INDEX system_modules_pkey ON public.system_modules USING btree (id);

CREATE UNIQUE INDEX ticket_actions_pkey ON public.ticket_actions USING btree (id);

CREATE UNIQUE INDEX tickets_pkey ON public.tickets USING btree (id);

CREATE UNIQUE INDEX workstations_pkey ON public.workstations USING btree (id);

alter table "public"."access_logs" add constraint "access_logs_pkey" PRIMARY KEY using index "access_logs_pkey";

alter table "public"."departments" add constraint "departments_pkey" PRIMARY KEY using index "departments_pkey";

alter table "public"."global_variables" add constraint "global_variables_pkey" PRIMARY KEY using index "global_variables_pkey";

alter table "public"."labor_rates" add constraint "labor_rates_pkey" PRIMARY KEY using index "labor_rates_pkey";

alter table "public"."machines" add constraint "machines_pkey" PRIMARY KEY using index "machines_pkey";

alter table "public"."material_costs_history" add constraint "material_costs_history_pkey" PRIMARY KEY using index "material_costs_history_pkey";

alter table "public"."materials" add constraint "materials_pkey" PRIMARY KEY using index "materials_pkey";

alter table "public"."product_configurations" add constraint "product_configurations_pkey" PRIMARY KEY using index "product_configurations_pkey";

alter table "public"."production_tasks" add constraint "production_tasks_pkey" PRIMARY KEY using index "production_tasks_pkey";

alter table "public"."ref_colors_paint" add constraint "ref_colors_paint_pkey" PRIMARY KEY using index "ref_colors_paint_pkey";

alter table "public"."ref_fonts" add constraint "ref_fonts_pkey" PRIMARY KEY using index "ref_fonts_pkey";

alter table "public"."ref_pictograms" add constraint "ref_pictograms_pkey" PRIMARY KEY using index "ref_pictograms_pkey";

alter table "public"."retail_curves" add constraint "retail_curves_pkey" PRIMARY KEY using index "retail_curves_pkey";

alter table "public"."retail_fixed_prices" add constraint "retail_fixed_prices_pkey" PRIMARY KEY using index "retail_fixed_prices_pkey";

alter table "public"."services" add constraint "services_pkey" PRIMARY KEY using index "services_pkey";

alter table "public"."staff" add constraint "staff_pkey" PRIMARY KEY using index "staff_pkey";

alter table "public"."system_modules" add constraint "system_modules_pkey" PRIMARY KEY using index "system_modules_pkey";

alter table "public"."ticket_actions" add constraint "ticket_actions_pkey" PRIMARY KEY using index "ticket_actions_pkey";

alter table "public"."tickets" add constraint "tickets_pkey" PRIMARY KEY using index "tickets_pkey";

alter table "public"."workstations" add constraint "workstations_pkey" PRIMARY KEY using index "workstations_pkey";

alter table "public"."labor_rates" add constraint "labor_rates_department_id_fkey" FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE not valid;

alter table "public"."labor_rates" validate constraint "labor_rates_department_id_fkey";

alter table "public"."material_costs_history" add constraint "chk_effective_dates" CHECK (((effective_to IS NULL) OR (effective_from < effective_to))) not valid;

alter table "public"."material_costs_history" validate constraint "chk_effective_dates";

alter table "public"."material_costs_history" add constraint "material_costs_history_sku_fkey" FOREIGN KEY (sku) REFERENCES public.materials(sku) ON DELETE CASCADE not valid;

alter table "public"."material_costs_history" validate constraint "material_costs_history_sku_fkey";

alter table "public"."production_tasks" add constraint "production_tasks_labor_role_id_fkey" FOREIGN KEY (labor_role_id) REFERENCES public.labor_rates(id) ON DELETE SET NULL not valid;

alter table "public"."production_tasks" validate constraint "production_tasks_labor_role_id_fkey";

alter table "public"."production_tasks" add constraint "production_tasks_workstation_id_fkey" FOREIGN KEY (workstation_id) REFERENCES public.workstations(id) ON DELETE SET NULL not valid;

alter table "public"."production_tasks" validate constraint "production_tasks_workstation_id_fkey";

alter table "public"."staff" add constraint "staff_department_id_fkey" FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL not valid;

alter table "public"."staff" validate constraint "staff_department_id_fkey";

alter table "public"."staff" add constraint "staff_email_key" UNIQUE using index "staff_email_key";

alter table "public"."staff" add constraint "staff_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."staff" validate constraint "staff_id_fkey";

alter table "public"."ticket_actions" add constraint "ticket_actions_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_actions" validate constraint "ticket_actions_ticket_id_fkey";

alter table "public"."ticket_actions" add constraint "ticket_actions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.staff(id) ON DELETE SET NULL not valid;

alter table "public"."ticket_actions" validate constraint "ticket_actions_user_id_fkey";

alter table "public"."tickets" add constraint "tickets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.staff(id) ON DELETE SET NULL not valid;

alter table "public"."tickets" validate constraint "tickets_user_id_fkey";

alter table "public"."workstations" add constraint "workstations_department_id_fkey" FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL not valid;

alter table "public"."workstations" validate constraint "workstations_department_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.calculate_yard_sign(p_inputs jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- 1. Extract inputs from the frontend payload
    v_qty numeric := COALESCE((p_inputs->>'qty')::numeric, 1);
    v_sides integer := COALESCE((p_inputs->>'sides')::integer, 1);
    v_has_stakes boolean := COALESCE((p_inputs->>'hasStakes')::boolean, false);
    
    -- 2. Variables for our database values
    v_min_order numeric;
    v_base_ss numeric;
    v_base_ds_adder numeric;
    v_tier1_qty numeric;
    v_tier1_price numeric;
    v_stake_price numeric := 1.50; -- Default retail price per stake
    
    -- 3. Receipt variables
    v_unit_price numeric := 0;
    v_print_total numeric := 0;
    v_stake_total numeric := 0;
    v_grand_total numeric := 0;
    v_is_min_applied boolean := false;
BEGIN
    -- Fetch the global shop minimum
    SELECT default_value INTO v_min_order FROM public.global_variables WHERE id = 'Retail_Min_Order';
    
    -- Fetch the Yard Sign configuration overrides
    SELECT 
        COALESCE((matrix_overrides->>'Retail_Price_Sign_SS')::numeric, 25.00),
        COALESCE((matrix_overrides->>'Retail_Price_Sign_DS')::numeric, 2.50),
        COALESCE((matrix_overrides->>'Tier_1_Qty')::numeric, 10),
        COALESCE((matrix_overrides->>'Tier_1_Price')::numeric, 23.75)
    INTO v_base_ss, v_base_ds_adder, v_tier1_qty, v_tier1_price
    FROM public.product_configurations WHERE id = 'PROD_Yard_Signs';
    
    -- MATH: Determine Base Price (Check for Volume Tier)
    IF v_qty >= v_tier1_qty THEN
        v_unit_price := v_tier1_price;
    ELSE
        v_unit_price := v_base_ss;
    END IF;
    
    -- MATH: Add Double Sided Fee
    IF v_sides = 2 THEN
        v_unit_price := v_unit_price + v_base_ds_adder;
    END IF;
    
    v_print_total := v_unit_price * v_qty;
    
    -- MATH: Hardware
    IF v_has_stakes THEN
        v_stake_total := v_stake_price * v_qty;
    END IF;
    
    v_grand_total := v_print_total + v_stake_total;
    
    -- MATH: Apply Shop Minimum Guardrail
    IF v_grand_total < v_min_order THEN
        v_grand_total := v_min_order;
        v_is_min_applied := true;
    END IF;
    
    -- Construct and return the exact JSON the frontend expects
    RETURN jsonb_build_object(
        'retail', jsonb_build_object(
            'unitPrice', v_unit_price + CASE WHEN v_has_stakes THEN v_stake_price ELSE 0 END,
            'grandTotal', v_grand_total,
            'printTotal', v_print_total,
            'stakeTotal', v_stake_total,
            'isMinApplied', v_is_min_applied
        ),
        'cost', jsonb_build_object('total', 0), -- Placeholder for future hard-cost tracking
        'metrics', jsonb_build_object('margin', 0.50)
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_product_bundle(p_product_id character varying, p_tables text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_payload JSONB := '{}'::jsonb;
    v_config JSONB;
    v_tables JSONB := '{}'::jsonb;
    v_table_name TEXT;
    v_table_data JSONB;
BEGIN
    -- 1. Fetch the Base Config using the function we just created
    v_config := get_product_config(p_product_id);
    v_payload := jsonb_build_object('config', v_config);

    -- 2. Fetch Additional Reference Tables if requested
    IF array_length(p_tables, 1) > 0 THEN
        FOREACH v_table_name IN ARRAY p_tables
        LOOP
            -- Since we normalized the materials into one table, we route requests dynamically
            IF v_table_name = 'REF_Colors_Vinyl' THEN
                SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_table_data 
                FROM (SELECT * FROM materials WHERE category = 'Roll') t;
                v_tables := jsonb_set(v_tables, ARRAY[v_table_name], v_table_data);
            
            ELSIF v_table_name = 'REF_Colors_Rowmark' THEN
                SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_table_data 
                FROM (SELECT * FROM materials WHERE category = 'ADA') t;
                v_tables := jsonb_set(v_tables, ARRAY[v_table_name], v_table_data);
                
            -- Add more ELSIF routing as needed for Fonts, Pictograms, etc.
            END IF;
        END LOOP;
        
        v_payload := jsonb_set(v_payload, '{tables}', v_tables);
    END IF;

    RETURN v_payload;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_product_config(p_product_id character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_config JSONB := '{}'::jsonb;
    v_globals JSONB;
    v_overrides JSONB;
    v_req_skus JSONB;
    v_sku_costs JSONB := '{}'::jsonb;
    v_blue_sheet JSONB := '{}'::jsonb;
BEGIN
    -- STEP 1: Fetch all standard Global Variables into a JSON object
    -- (Replaces REF_Cost_Definitions)
    SELECT COALESCE(jsonb_object_agg(id, default_value), '{}'::jsonb)
    INTO v_globals
    FROM global_variables;

    -- STEP 2: Fetch the specific Product Overrides and Required SKUs
    -- (Replaces SYS_Cost_Matrix and the PROD_ tabs)
    SELECT matrix_overrides, required_skus
    INTO v_overrides, v_req_skus
    FROM product_configurations
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product configuration % not found', p_product_id;
    END IF;

    -- Merge Globals with Overrides. (Overrides overwrite default globals seamlessly)
    v_config := v_globals || COALESCE(v_overrides, '{}'::jsonb);

    -- STEP 3: Dynamic VLOOKUP Replacement
    -- If the product requires physical materials, fetch their CURRENT active cost.
    -- (The JSON maps the JS variable name to the SKU: {"Cost_Stock_4mm": "SUB_COR_4MM"})
    IF v_req_skus IS NOT NULL AND jsonb_typeof(v_req_skus) = 'object' THEN
        SELECT COALESCE(jsonb_object_agg(
            kv.key, 
            COALESCE(
                (SELECT internal_cost FROM material_costs_history mch WHERE mch.sku = kv.value AND mch.effective_to IS NULL LIMIT 1),
                (SELECT cost_basis FROM services s WHERE s.sku = kv.value LIMIT 1),
                0 -- Default to 0 if SKU is missing
            )
        ), '{}'::jsonb)
        INTO v_sku_costs
        FROM jsonb_each_text(v_req_skus) kv;
        
        -- Merge the resolved hardware/material costs into the payload
        v_config := v_config || v_sku_costs;
    END IF;

    -- STEP 4: Fetch Blue Sheet Retail pricing (Mimics your fixed price array)
    -- Formats as ID_1 and ID_10 just like the Apps Script did
    SELECT 
        COALESCE(jsonb_object_agg(id || '_1', price_qty_1), '{}'::jsonb) || 
        COALESCE(jsonb_object_agg(id || '_10', price_qty_10), '{}'::jsonb)
    INTO v_blue_sheet
    FROM retail_fixed_prices;

    v_config := v_config || v_blue_sheet;

    RETURN v_config;
END;
$function$
;

grant delete on table "public"."access_logs" to "anon";

grant insert on table "public"."access_logs" to "anon";

grant references on table "public"."access_logs" to "anon";

grant select on table "public"."access_logs" to "anon";

grant trigger on table "public"."access_logs" to "anon";

grant truncate on table "public"."access_logs" to "anon";

grant update on table "public"."access_logs" to "anon";

grant delete on table "public"."access_logs" to "authenticated";

grant insert on table "public"."access_logs" to "authenticated";

grant references on table "public"."access_logs" to "authenticated";

grant select on table "public"."access_logs" to "authenticated";

grant trigger on table "public"."access_logs" to "authenticated";

grant truncate on table "public"."access_logs" to "authenticated";

grant update on table "public"."access_logs" to "authenticated";

grant delete on table "public"."access_logs" to "service_role";

grant insert on table "public"."access_logs" to "service_role";

grant references on table "public"."access_logs" to "service_role";

grant select on table "public"."access_logs" to "service_role";

grant trigger on table "public"."access_logs" to "service_role";

grant truncate on table "public"."access_logs" to "service_role";

grant update on table "public"."access_logs" to "service_role";

grant delete on table "public"."departments" to "anon";

grant insert on table "public"."departments" to "anon";

grant references on table "public"."departments" to "anon";

grant select on table "public"."departments" to "anon";

grant trigger on table "public"."departments" to "anon";

grant truncate on table "public"."departments" to "anon";

grant update on table "public"."departments" to "anon";

grant delete on table "public"."departments" to "authenticated";

grant insert on table "public"."departments" to "authenticated";

grant references on table "public"."departments" to "authenticated";

grant select on table "public"."departments" to "authenticated";

grant trigger on table "public"."departments" to "authenticated";

grant truncate on table "public"."departments" to "authenticated";

grant update on table "public"."departments" to "authenticated";

grant delete on table "public"."departments" to "service_role";

grant insert on table "public"."departments" to "service_role";

grant references on table "public"."departments" to "service_role";

grant select on table "public"."departments" to "service_role";

grant trigger on table "public"."departments" to "service_role";

grant truncate on table "public"."departments" to "service_role";

grant update on table "public"."departments" to "service_role";

grant delete on table "public"."global_variables" to "anon";

grant insert on table "public"."global_variables" to "anon";

grant references on table "public"."global_variables" to "anon";

grant select on table "public"."global_variables" to "anon";

grant trigger on table "public"."global_variables" to "anon";

grant truncate on table "public"."global_variables" to "anon";

grant update on table "public"."global_variables" to "anon";

grant delete on table "public"."global_variables" to "authenticated";

grant insert on table "public"."global_variables" to "authenticated";

grant references on table "public"."global_variables" to "authenticated";

grant select on table "public"."global_variables" to "authenticated";

grant trigger on table "public"."global_variables" to "authenticated";

grant truncate on table "public"."global_variables" to "authenticated";

grant update on table "public"."global_variables" to "authenticated";

grant delete on table "public"."global_variables" to "service_role";

grant insert on table "public"."global_variables" to "service_role";

grant references on table "public"."global_variables" to "service_role";

grant select on table "public"."global_variables" to "service_role";

grant trigger on table "public"."global_variables" to "service_role";

grant truncate on table "public"."global_variables" to "service_role";

grant update on table "public"."global_variables" to "service_role";

grant delete on table "public"."labor_rates" to "anon";

grant insert on table "public"."labor_rates" to "anon";

grant references on table "public"."labor_rates" to "anon";

grant select on table "public"."labor_rates" to "anon";

grant trigger on table "public"."labor_rates" to "anon";

grant truncate on table "public"."labor_rates" to "anon";

grant update on table "public"."labor_rates" to "anon";

grant delete on table "public"."labor_rates" to "authenticated";

grant insert on table "public"."labor_rates" to "authenticated";

grant references on table "public"."labor_rates" to "authenticated";

grant select on table "public"."labor_rates" to "authenticated";

grant trigger on table "public"."labor_rates" to "authenticated";

grant truncate on table "public"."labor_rates" to "authenticated";

grant update on table "public"."labor_rates" to "authenticated";

grant delete on table "public"."labor_rates" to "service_role";

grant insert on table "public"."labor_rates" to "service_role";

grant references on table "public"."labor_rates" to "service_role";

grant select on table "public"."labor_rates" to "service_role";

grant trigger on table "public"."labor_rates" to "service_role";

grant truncate on table "public"."labor_rates" to "service_role";

grant update on table "public"."labor_rates" to "service_role";

grant delete on table "public"."machines" to "anon";

grant insert on table "public"."machines" to "anon";

grant references on table "public"."machines" to "anon";

grant select on table "public"."machines" to "anon";

grant trigger on table "public"."machines" to "anon";

grant truncate on table "public"."machines" to "anon";

grant update on table "public"."machines" to "anon";

grant delete on table "public"."machines" to "authenticated";

grant insert on table "public"."machines" to "authenticated";

grant references on table "public"."machines" to "authenticated";

grant select on table "public"."machines" to "authenticated";

grant trigger on table "public"."machines" to "authenticated";

grant truncate on table "public"."machines" to "authenticated";

grant update on table "public"."machines" to "authenticated";

grant delete on table "public"."machines" to "service_role";

grant insert on table "public"."machines" to "service_role";

grant references on table "public"."machines" to "service_role";

grant select on table "public"."machines" to "service_role";

grant trigger on table "public"."machines" to "service_role";

grant truncate on table "public"."machines" to "service_role";

grant update on table "public"."machines" to "service_role";

grant delete on table "public"."material_costs_history" to "anon";

grant insert on table "public"."material_costs_history" to "anon";

grant references on table "public"."material_costs_history" to "anon";

grant select on table "public"."material_costs_history" to "anon";

grant trigger on table "public"."material_costs_history" to "anon";

grant truncate on table "public"."material_costs_history" to "anon";

grant update on table "public"."material_costs_history" to "anon";

grant delete on table "public"."material_costs_history" to "authenticated";

grant insert on table "public"."material_costs_history" to "authenticated";

grant references on table "public"."material_costs_history" to "authenticated";

grant select on table "public"."material_costs_history" to "authenticated";

grant trigger on table "public"."material_costs_history" to "authenticated";

grant truncate on table "public"."material_costs_history" to "authenticated";

grant update on table "public"."material_costs_history" to "authenticated";

grant delete on table "public"."material_costs_history" to "service_role";

grant insert on table "public"."material_costs_history" to "service_role";

grant references on table "public"."material_costs_history" to "service_role";

grant select on table "public"."material_costs_history" to "service_role";

grant trigger on table "public"."material_costs_history" to "service_role";

grant truncate on table "public"."material_costs_history" to "service_role";

grant update on table "public"."material_costs_history" to "service_role";

grant delete on table "public"."materials" to "anon";

grant insert on table "public"."materials" to "anon";

grant references on table "public"."materials" to "anon";

grant select on table "public"."materials" to "anon";

grant trigger on table "public"."materials" to "anon";

grant truncate on table "public"."materials" to "anon";

grant update on table "public"."materials" to "anon";

grant delete on table "public"."materials" to "authenticated";

grant insert on table "public"."materials" to "authenticated";

grant references on table "public"."materials" to "authenticated";

grant select on table "public"."materials" to "authenticated";

grant trigger on table "public"."materials" to "authenticated";

grant truncate on table "public"."materials" to "authenticated";

grant update on table "public"."materials" to "authenticated";

grant delete on table "public"."materials" to "service_role";

grant insert on table "public"."materials" to "service_role";

grant references on table "public"."materials" to "service_role";

grant select on table "public"."materials" to "service_role";

grant trigger on table "public"."materials" to "service_role";

grant truncate on table "public"."materials" to "service_role";

grant update on table "public"."materials" to "service_role";

grant delete on table "public"."product_configurations" to "anon";

grant insert on table "public"."product_configurations" to "anon";

grant references on table "public"."product_configurations" to "anon";

grant select on table "public"."product_configurations" to "anon";

grant trigger on table "public"."product_configurations" to "anon";

grant truncate on table "public"."product_configurations" to "anon";

grant update on table "public"."product_configurations" to "anon";

grant delete on table "public"."product_configurations" to "authenticated";

grant insert on table "public"."product_configurations" to "authenticated";

grant references on table "public"."product_configurations" to "authenticated";

grant select on table "public"."product_configurations" to "authenticated";

grant trigger on table "public"."product_configurations" to "authenticated";

grant truncate on table "public"."product_configurations" to "authenticated";

grant update on table "public"."product_configurations" to "authenticated";

grant delete on table "public"."product_configurations" to "service_role";

grant insert on table "public"."product_configurations" to "service_role";

grant references on table "public"."product_configurations" to "service_role";

grant select on table "public"."product_configurations" to "service_role";

grant trigger on table "public"."product_configurations" to "service_role";

grant truncate on table "public"."product_configurations" to "service_role";

grant update on table "public"."product_configurations" to "service_role";

grant delete on table "public"."production_tasks" to "anon";

grant insert on table "public"."production_tasks" to "anon";

grant references on table "public"."production_tasks" to "anon";

grant select on table "public"."production_tasks" to "anon";

grant trigger on table "public"."production_tasks" to "anon";

grant truncate on table "public"."production_tasks" to "anon";

grant update on table "public"."production_tasks" to "anon";

grant delete on table "public"."production_tasks" to "authenticated";

grant insert on table "public"."production_tasks" to "authenticated";

grant references on table "public"."production_tasks" to "authenticated";

grant select on table "public"."production_tasks" to "authenticated";

grant trigger on table "public"."production_tasks" to "authenticated";

grant truncate on table "public"."production_tasks" to "authenticated";

grant update on table "public"."production_tasks" to "authenticated";

grant delete on table "public"."production_tasks" to "service_role";

grant insert on table "public"."production_tasks" to "service_role";

grant references on table "public"."production_tasks" to "service_role";

grant select on table "public"."production_tasks" to "service_role";

grant trigger on table "public"."production_tasks" to "service_role";

grant truncate on table "public"."production_tasks" to "service_role";

grant update on table "public"."production_tasks" to "service_role";

grant delete on table "public"."ref_colors_paint" to "anon";

grant insert on table "public"."ref_colors_paint" to "anon";

grant references on table "public"."ref_colors_paint" to "anon";

grant select on table "public"."ref_colors_paint" to "anon";

grant trigger on table "public"."ref_colors_paint" to "anon";

grant truncate on table "public"."ref_colors_paint" to "anon";

grant update on table "public"."ref_colors_paint" to "anon";

grant delete on table "public"."ref_colors_paint" to "authenticated";

grant insert on table "public"."ref_colors_paint" to "authenticated";

grant references on table "public"."ref_colors_paint" to "authenticated";

grant select on table "public"."ref_colors_paint" to "authenticated";

grant trigger on table "public"."ref_colors_paint" to "authenticated";

grant truncate on table "public"."ref_colors_paint" to "authenticated";

grant update on table "public"."ref_colors_paint" to "authenticated";

grant delete on table "public"."ref_colors_paint" to "service_role";

grant insert on table "public"."ref_colors_paint" to "service_role";

grant references on table "public"."ref_colors_paint" to "service_role";

grant select on table "public"."ref_colors_paint" to "service_role";

grant trigger on table "public"."ref_colors_paint" to "service_role";

grant truncate on table "public"."ref_colors_paint" to "service_role";

grant update on table "public"."ref_colors_paint" to "service_role";

grant delete on table "public"."ref_fonts" to "anon";

grant insert on table "public"."ref_fonts" to "anon";

grant references on table "public"."ref_fonts" to "anon";

grant select on table "public"."ref_fonts" to "anon";

grant trigger on table "public"."ref_fonts" to "anon";

grant truncate on table "public"."ref_fonts" to "anon";

grant update on table "public"."ref_fonts" to "anon";

grant delete on table "public"."ref_fonts" to "authenticated";

grant insert on table "public"."ref_fonts" to "authenticated";

grant references on table "public"."ref_fonts" to "authenticated";

grant select on table "public"."ref_fonts" to "authenticated";

grant trigger on table "public"."ref_fonts" to "authenticated";

grant truncate on table "public"."ref_fonts" to "authenticated";

grant update on table "public"."ref_fonts" to "authenticated";

grant delete on table "public"."ref_fonts" to "service_role";

grant insert on table "public"."ref_fonts" to "service_role";

grant references on table "public"."ref_fonts" to "service_role";

grant select on table "public"."ref_fonts" to "service_role";

grant trigger on table "public"."ref_fonts" to "service_role";

grant truncate on table "public"."ref_fonts" to "service_role";

grant update on table "public"."ref_fonts" to "service_role";

grant delete on table "public"."ref_pictograms" to "anon";

grant insert on table "public"."ref_pictograms" to "anon";

grant references on table "public"."ref_pictograms" to "anon";

grant select on table "public"."ref_pictograms" to "anon";

grant trigger on table "public"."ref_pictograms" to "anon";

grant truncate on table "public"."ref_pictograms" to "anon";

grant update on table "public"."ref_pictograms" to "anon";

grant delete on table "public"."ref_pictograms" to "authenticated";

grant insert on table "public"."ref_pictograms" to "authenticated";

grant references on table "public"."ref_pictograms" to "authenticated";

grant select on table "public"."ref_pictograms" to "authenticated";

grant trigger on table "public"."ref_pictograms" to "authenticated";

grant truncate on table "public"."ref_pictograms" to "authenticated";

grant update on table "public"."ref_pictograms" to "authenticated";

grant delete on table "public"."ref_pictograms" to "service_role";

grant insert on table "public"."ref_pictograms" to "service_role";

grant references on table "public"."ref_pictograms" to "service_role";

grant select on table "public"."ref_pictograms" to "service_role";

grant trigger on table "public"."ref_pictograms" to "service_role";

grant truncate on table "public"."ref_pictograms" to "service_role";

grant update on table "public"."ref_pictograms" to "service_role";

grant delete on table "public"."retail_curves" to "anon";

grant insert on table "public"."retail_curves" to "anon";

grant references on table "public"."retail_curves" to "anon";

grant select on table "public"."retail_curves" to "anon";

grant trigger on table "public"."retail_curves" to "anon";

grant truncate on table "public"."retail_curves" to "anon";

grant update on table "public"."retail_curves" to "anon";

grant delete on table "public"."retail_curves" to "authenticated";

grant insert on table "public"."retail_curves" to "authenticated";

grant references on table "public"."retail_curves" to "authenticated";

grant select on table "public"."retail_curves" to "authenticated";

grant trigger on table "public"."retail_curves" to "authenticated";

grant truncate on table "public"."retail_curves" to "authenticated";

grant update on table "public"."retail_curves" to "authenticated";

grant delete on table "public"."retail_curves" to "service_role";

grant insert on table "public"."retail_curves" to "service_role";

grant references on table "public"."retail_curves" to "service_role";

grant select on table "public"."retail_curves" to "service_role";

grant trigger on table "public"."retail_curves" to "service_role";

grant truncate on table "public"."retail_curves" to "service_role";

grant update on table "public"."retail_curves" to "service_role";

grant delete on table "public"."retail_fixed_prices" to "anon";

grant insert on table "public"."retail_fixed_prices" to "anon";

grant references on table "public"."retail_fixed_prices" to "anon";

grant select on table "public"."retail_fixed_prices" to "anon";

grant trigger on table "public"."retail_fixed_prices" to "anon";

grant truncate on table "public"."retail_fixed_prices" to "anon";

grant update on table "public"."retail_fixed_prices" to "anon";

grant delete on table "public"."retail_fixed_prices" to "authenticated";

grant insert on table "public"."retail_fixed_prices" to "authenticated";

grant references on table "public"."retail_fixed_prices" to "authenticated";

grant select on table "public"."retail_fixed_prices" to "authenticated";

grant trigger on table "public"."retail_fixed_prices" to "authenticated";

grant truncate on table "public"."retail_fixed_prices" to "authenticated";

grant update on table "public"."retail_fixed_prices" to "authenticated";

grant delete on table "public"."retail_fixed_prices" to "service_role";

grant insert on table "public"."retail_fixed_prices" to "service_role";

grant references on table "public"."retail_fixed_prices" to "service_role";

grant select on table "public"."retail_fixed_prices" to "service_role";

grant trigger on table "public"."retail_fixed_prices" to "service_role";

grant truncate on table "public"."retail_fixed_prices" to "service_role";

grant update on table "public"."retail_fixed_prices" to "service_role";

grant delete on table "public"."services" to "anon";

grant insert on table "public"."services" to "anon";

grant references on table "public"."services" to "anon";

grant select on table "public"."services" to "anon";

grant trigger on table "public"."services" to "anon";

grant truncate on table "public"."services" to "anon";

grant update on table "public"."services" to "anon";

grant delete on table "public"."services" to "authenticated";

grant insert on table "public"."services" to "authenticated";

grant references on table "public"."services" to "authenticated";

grant select on table "public"."services" to "authenticated";

grant trigger on table "public"."services" to "authenticated";

grant truncate on table "public"."services" to "authenticated";

grant update on table "public"."services" to "authenticated";

grant delete on table "public"."services" to "service_role";

grant insert on table "public"."services" to "service_role";

grant references on table "public"."services" to "service_role";

grant select on table "public"."services" to "service_role";

grant trigger on table "public"."services" to "service_role";

grant truncate on table "public"."services" to "service_role";

grant update on table "public"."services" to "service_role";

grant delete on table "public"."staff" to "anon";

grant insert on table "public"."staff" to "anon";

grant references on table "public"."staff" to "anon";

grant select on table "public"."staff" to "anon";

grant trigger on table "public"."staff" to "anon";

grant truncate on table "public"."staff" to "anon";

grant update on table "public"."staff" to "anon";

grant delete on table "public"."staff" to "authenticated";

grant insert on table "public"."staff" to "authenticated";

grant references on table "public"."staff" to "authenticated";

grant select on table "public"."staff" to "authenticated";

grant trigger on table "public"."staff" to "authenticated";

grant truncate on table "public"."staff" to "authenticated";

grant update on table "public"."staff" to "authenticated";

grant delete on table "public"."staff" to "service_role";

grant insert on table "public"."staff" to "service_role";

grant references on table "public"."staff" to "service_role";

grant select on table "public"."staff" to "service_role";

grant trigger on table "public"."staff" to "service_role";

grant truncate on table "public"."staff" to "service_role";

grant update on table "public"."staff" to "service_role";

grant delete on table "public"."system_modules" to "anon";

grant insert on table "public"."system_modules" to "anon";

grant references on table "public"."system_modules" to "anon";

grant select on table "public"."system_modules" to "anon";

grant trigger on table "public"."system_modules" to "anon";

grant truncate on table "public"."system_modules" to "anon";

grant update on table "public"."system_modules" to "anon";

grant delete on table "public"."system_modules" to "authenticated";

grant insert on table "public"."system_modules" to "authenticated";

grant references on table "public"."system_modules" to "authenticated";

grant select on table "public"."system_modules" to "authenticated";

grant trigger on table "public"."system_modules" to "authenticated";

grant truncate on table "public"."system_modules" to "authenticated";

grant update on table "public"."system_modules" to "authenticated";

grant delete on table "public"."system_modules" to "service_role";

grant insert on table "public"."system_modules" to "service_role";

grant references on table "public"."system_modules" to "service_role";

grant select on table "public"."system_modules" to "service_role";

grant trigger on table "public"."system_modules" to "service_role";

grant truncate on table "public"."system_modules" to "service_role";

grant update on table "public"."system_modules" to "service_role";

grant delete on table "public"."ticket_actions" to "anon";

grant insert on table "public"."ticket_actions" to "anon";

grant references on table "public"."ticket_actions" to "anon";

grant select on table "public"."ticket_actions" to "anon";

grant trigger on table "public"."ticket_actions" to "anon";

grant truncate on table "public"."ticket_actions" to "anon";

grant update on table "public"."ticket_actions" to "anon";

grant delete on table "public"."ticket_actions" to "authenticated";

grant insert on table "public"."ticket_actions" to "authenticated";

grant references on table "public"."ticket_actions" to "authenticated";

grant select on table "public"."ticket_actions" to "authenticated";

grant trigger on table "public"."ticket_actions" to "authenticated";

grant truncate on table "public"."ticket_actions" to "authenticated";

grant update on table "public"."ticket_actions" to "authenticated";

grant delete on table "public"."ticket_actions" to "service_role";

grant insert on table "public"."ticket_actions" to "service_role";

grant references on table "public"."ticket_actions" to "service_role";

grant select on table "public"."ticket_actions" to "service_role";

grant trigger on table "public"."ticket_actions" to "service_role";

grant truncate on table "public"."ticket_actions" to "service_role";

grant update on table "public"."ticket_actions" to "service_role";

grant delete on table "public"."tickets" to "anon";

grant insert on table "public"."tickets" to "anon";

grant references on table "public"."tickets" to "anon";

grant select on table "public"."tickets" to "anon";

grant trigger on table "public"."tickets" to "anon";

grant truncate on table "public"."tickets" to "anon";

grant update on table "public"."tickets" to "anon";

grant delete on table "public"."tickets" to "authenticated";

grant insert on table "public"."tickets" to "authenticated";

grant references on table "public"."tickets" to "authenticated";

grant select on table "public"."tickets" to "authenticated";

grant trigger on table "public"."tickets" to "authenticated";

grant truncate on table "public"."tickets" to "authenticated";

grant update on table "public"."tickets" to "authenticated";

grant delete on table "public"."tickets" to "service_role";

grant insert on table "public"."tickets" to "service_role";

grant references on table "public"."tickets" to "service_role";

grant select on table "public"."tickets" to "service_role";

grant trigger on table "public"."tickets" to "service_role";

grant truncate on table "public"."tickets" to "service_role";

grant update on table "public"."tickets" to "service_role";

grant delete on table "public"."workstations" to "anon";

grant insert on table "public"."workstations" to "anon";

grant references on table "public"."workstations" to "anon";

grant select on table "public"."workstations" to "anon";

grant trigger on table "public"."workstations" to "anon";

grant truncate on table "public"."workstations" to "anon";

grant update on table "public"."workstations" to "anon";

grant delete on table "public"."workstations" to "authenticated";

grant insert on table "public"."workstations" to "authenticated";

grant references on table "public"."workstations" to "authenticated";

grant select on table "public"."workstations" to "authenticated";

grant trigger on table "public"."workstations" to "authenticated";

grant truncate on table "public"."workstations" to "authenticated";

grant update on table "public"."workstations" to "authenticated";

grant delete on table "public"."workstations" to "service_role";

grant insert on table "public"."workstations" to "service_role";

grant references on table "public"."workstations" to "service_role";

grant select on table "public"."workstations" to "service_role";

grant trigger on table "public"."workstations" to "service_role";

grant truncate on table "public"."workstations" to "service_role";

grant update on table "public"."workstations" to "service_role";


