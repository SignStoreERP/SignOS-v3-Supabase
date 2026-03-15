/**
 * UI SCHEMA ENGINE: ADA Quoter
 * Notice: All physics and pricing math has been securely migrated to Supabase Edge Functions.
 * This file now only instructs the Universal Sandbox which variables to display.
 */
window.ENGRAVED_CONFIG = {
    tab: 'PROD_ADA_Signs',
    controls: [
        { id: 'w', label: 'Width', type: 'number', def: 8 },
        { id: 'h', label: 'Height', type: 'number', def: 8 }
    ],
    retails: [
        { key: 'Retail_Price_ADA_Basic_AB', label: 'Basic ADA ($/Sqin)' },
        { key: 'Retail_Price_ADA_Basic_Clear', label: 'Acr ADA ($/Sqin)' },
        { key: 'Retail_Price_Window_Paper', label: 'Paper Window ($/Sqin)' },
        { key: 'Retail_Price_Window_Engraved', label: 'Engraved Slider ($/Sqin)' },
        { key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
        { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' }
    ],
    costs: [
        { key: 'Cost_Sub_ADA_Core_116', label: '1/16" Core ($/Sht)' },
        { key: 'Cost_Sub_ADA_Core_18', label: '1/8" Core ($/Sht)' },
        { key: 'Cost_Sub_Tactile', label: '1/32" Tactile ($/Sht)' },
        { key: 'Cost_Sub_PVC', label: '3mm PVC ($/Sht)' },
        { key: 'Cost_Stock_6mm_4x8', label: '6mm PVC ($/Sht)' },
        { key: 'Cost_Sub_Acrylic', label: '3/16" Clear ($/Sht)' },
        { key: 'ADA_APP_132_CLR', label: '1/32" Clear Lens ($/Sht)' },
        { key: 'Cost_Raster_Bead', label: 'Raster Bead ($/Ea)' },
        { key: 'Cost_Paint_SqIn', label: 'Paint ($/SqIn)' },
        { key: 'Cost_Hem_Tape', label: 'Tape ($/Roll)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'CNC Mach ($/Hr)' },
        { key: 'Time_Preflight_Job', label: 'File Preflight (Mins)' },
        { key: 'Time_Engraver_Load_Per_Item', label: 'Load Item (Mins)' },
        { key: 'Time_Engrave_SqIn', label: 'Engrave (Mins/Sqin)' },
        { key: 'Time_Paint_Setup', label: 'Paint Setup (Mins)' },
        { key: 'Time_Paint_SqIn', label: 'Paint (Mins/Sqin)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC Time (Mins/SqFt)' },
        { key: 'Waste_Factor', label: 'Waste Factor' },
        { key: 'Factor_Risk', label: 'Risk Factor' }
    ],
    constants: [
        { key: 'C_1152', val: '1152', label: '1152 (ADA Sheet)', desc: 'SqIn yield of a 24" x 48" half-sheet.' },
        { key: 'C_4608', val: '4608', label: '4608 (Full Sheet)', desc: 'SqIn yield of a full 4\' x 8\' sheet.' },
        { key: 'C_144', val: '144', label: '144 (SqFt Base)', desc: 'SqIn per SqFt.' },
        { key: 'C_005', val: '0.05', label: '0.05 Mins', desc: 'Estimated shop labor time to manually insert a single Raster Braille Bead.' },
        { key: 'C_2', val: '2', label: '2 Mins', desc: 'Estimated shop labor time to align, tape, and press a single material layer.' }
    ]
};