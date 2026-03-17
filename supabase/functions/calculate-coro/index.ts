// --- 1. RETAIL ENGINE (STRICT MATRIX LOOKUP) ---
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

let matrixPrice = 0;
let mappedBox = "";

if (supabaseUrl && supabaseKey) {
    // 1. Fetch all standard prices for this material and thickness
    const pQuery = thk.includes('10') ? '*10mm*Coro*' : '*4mm*Coro*';
    const res = await fetch(`${supabaseUrl}/rest/v1/retail_fixed_prices?product_line=ilike.${pQuery}&select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });

    if (res.ok) {
        const fixedPrices = await res.json();
        
        // Use Infinity so any found area is smaller
        let bestArea = Infinity;
        let selectedRow = null;

        for (const row of fixedPrices) {
            if (!row.dimensions || !row.dimensions.includes('x')) continue;
            
            // Parse standard sizes (e.g., "24x18")
            const parts = row.dimensions.toLowerCase().split('x');
            const sw = parseFloat(parts);
            const sh = parseFloat(parts[3]);

            // Check if this standard sign can fit the requested size
            // We check both orientations (Portrait vs Landscape)
            const fitsStandard = (sw >= reqW && sh >= reqH);
            const fitsRotated = (sh >= reqW && sw >= reqH);

            if (fitsStandard || fitsRotated) {
                const area = sw * sh;
                // We want the smallest standard sign that fits the request
                if (area < bestArea) {
                    bestArea = area;
                    selectedRow = { ...row, w: sw, h: sh };
                }
            }
        }

        if (selectedRow) {
            mappedBox = selectedRow.dimensions;
            const sidesStr = reqSides === 2 ? 'Double' : 'Single';
            
            // Look for the exact Single or Double Sided match for the box we found
            let match = fixedPrices.find((r: any) => r.dimensions === mappedBox && r.sides === sidesStr);

            if (match) {
                // Exact match found!
                matrixPrice = parseFloat(match.price_qty_1 || "0");
                let bulk = match.price_qty_10; // Fixed column name to match your DB
                
                if (qty >= 10 && bulk) matrixPrice = parseFloat(bulk);
                else if (qty >= 10) matrixPrice *= 0.95; // 5% fallback discount
                
            } else {
                // If double-sided isn't explicitly in the DB, find Single-Sided and calculate it
                let single = fixedPrices.find((r: any) => r.dimensions === mappedBox && r.sides === 'Single');
                if (single) {
                    let base = parseFloat(single.price_qty_1 || "0");
                    let bulk = single.price_qty_10;
                    
                    if (qty >= 10 && bulk) base = parseFloat(bulk);
                    else if (qty >= 10) base *= 0.95;
                    
                    matrixPrice = reqSides === 2 ? base * (1 + parseFloat(config.Retail_Adder_DS_Mult || "0.5")) : base;
                }
            }
        }
    }
}

let unitPrintTotal = 0;
if (matrixPrice > 0) {
    unitPrintTotal = matrixPrice * qty;
    // Uses the R() function to pipe the logic to your Sandbox Ledger UI
    R(`Sign Print (${thk} Mapped to ${mappedBox})`, unitPrintTotal, `${qty}x Signs @ $${matrixPrice.toFixed(2)}/ea (Matrix Lookup)`);
} else {
    // --- 2. FALLBACK ENGINE (If size is larger than any standard sign) ---
    // Standard square foot curve math goes here...
}