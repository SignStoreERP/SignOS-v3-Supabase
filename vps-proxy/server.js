require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { calculateChannelLetters } = require('./engine');

// 1. Initialize Supabase with Service Role Key to securely bypass RLS
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("⚠️ WARNING: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/process-cartridge', async (req, res) => {
    try {
        const config = req.body;
        
        // 2. Fetch live material and labor costs from Supabase
        const { data: rawVariables, error } = await supabase
            .from('global_variables')
            .select('id, default_value');

        if (error) {
            throw new Error(`Supabase fetch error: ${error.message}`);
        }

        // 3. Map the data to the format expected by the engine
        // (id -> name, default_value -> value)
        const globalVariables = rawVariables.map(item => ({
            name: item.id,
            value: item.default_value
        }));
        
        const retailCurves = {}; // Placeholder for future volume discount curves

        // 4. Run the Twin-Engine calculation with live data
        const engineResult = calculateChannelLetters(config, globalVariables, retailCurves);

        // 5. Map the SignOS internal format to the React Frontend's PricingQuote interface
        const subtotal = engineResult.retail.grandTotal;
        const tax = subtotal * 0.0825; // Standard 8.25% tax rate
        const total = subtotal + tax;

        const frontendQuote = {
            items: engineResult.retail.breakdown,
            subtotal: subtotal,
            tax: tax,
            total: total,
            requiresQuote: false
        };

        // 6. Return the payload
        res.json({
            success: true,
            data: frontendQuote,
            // We pass the raw engine result back as 'debug' so you can inspect 
            // the hard costs and margins in the browser console!
            debug: engineResult 
        });

    } catch (error) {
        console.error('Error processing cartridge:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`VPS Proxy Server running on http://localhost:${PORT}`);
});