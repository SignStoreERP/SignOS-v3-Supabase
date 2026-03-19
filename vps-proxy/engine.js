// vps-proxy/engine.js

/**
 * Twin-Engine Pricing Calculator for Channel Letters
 * Calculates both Hard Cost (physics/yield) and Retail (market value)
 */
function calculateChannelLetters(config, globalVariables, retailCurves) {
    // Helper to extract dynamic variables from Supabase array
    const getVar = (name, fallback = 0) => {
        const variable = globalVariables.find(g => g.name === name);
        return variable ? parseFloat(variable.value) : fallback;
    };

    // --- 1. EXTRACT CONFIG & ESTIMATE METRICS ---
    const height = config.dimensions?.height || 12;
    const lines = config.lines || [];
    const totalChars = lines.reduce((acc, line) => acc + line.replace(/\s/g, '').length, 0);
    
    // Geometric Estimates
    // Assume average letter width is ~80% of height
    const sqFtPerLetter = (height * (height * 0.8)) / 144;
    const totalSqFt = sqFtPerLetter * totalChars;
    
    // Estimate perimeter (inches) for returns and trim cap
    const perimeterPerLetter = height * 3.5; 
    const totalPerimeterFt = (perimeterPerLetter * totalChars) / 12;

    // --- 2. HARD COSTS (MATERIALS) ---
    const costAcrylic = totalSqFt * getVar('Cost_Acrylic_SqFt', 3.50);
    const costTrimCap = totalPerimeterFt * getVar('Cost_Trim_Cap_Ft', 0.45);
    const costReturns = totalPerimeterFt * getVar('Cost_Aluminum_Return_Ft', 1.20);
    const costLEDs = totalSqFt * getVar('Cost_LED_Module_SqFt', 12.00);
    
    const totalMaterialCost = costAcrylic + costTrimCap + costReturns + costLEDs;

    // --- 3. HARD COSTS (LABOR) ---
    const laborRate = getVar('Rate_Shop_Labor', 65.00);
    
    // Time studies (estimated hours)
    const hoursRouting = totalSqFt * 0.1;
    const hoursBending = totalPerimeterFt * 0.05;
    const hoursAssembly = totalChars * 0.5;
    const hoursPaint = totalSqFt * 0.2; // Assuming painted returns/raceway
    
    const totalHours = hoursRouting + hoursBending + hoursAssembly + hoursPaint;
    const totalLaborCost = totalHours * laborRate;

    const totalHardCost = totalMaterialCost + totalLaborCost;

    // --- 4. RETAIL CALCULATION (MARKET VALUE) ---
    const markup = getVar('Markup_Multiplier', 2.5);
    const retailMaterial = totalMaterialCost * markup;
    const retailLabor = totalLaborCost * markup;
    const grandTotal = retailMaterial + retailLabor;

    // --- 5. THE DATA CONTRACT ---
    return {
        cost: {
            total: totalHardCost,
            breakdown: [
                { category: 'Material', name: 'Acrylic Faces', cost: costAcrylic },
                { category: 'Material', name: 'Trim Cap', cost: costTrimCap },
                { category: 'Material', name: 'Aluminum Returns', cost: costReturns },
                { category: 'Material', name: 'LED Illumination', cost: costLEDs },
                { category: 'Labor', name: 'CNC Routing', cost: hoursRouting * laborRate },
                { category: 'Labor', name: 'Letter Bending', cost: hoursBending * laborRate },
                { category: 'Labor', name: 'Assembly', cost: hoursAssembly * laborRate },
                { category: 'Labor', name: 'Painting', cost: hoursPaint * laborRate }
            ]
        },
        retail: {
            grandTotal: grandTotal,
            breakdown: [
                { 
                    id: 'MAT-01', 
                    category: 'Materials', 
                    description: `Channel Letter Materials (${totalChars} letters @ ${height}")`, 
                    qty: totalChars, 
                    unit: 'ltr', 
                    unitPrice: retailMaterial / (totalChars || 1), 
                    total: retailMaterial 
                },
                { 
                    id: 'LAB-01', 
                    category: 'Labor', 
                    description: 'Fabrication, Wiring & Assembly Labor', 
                    qty: totalHours, 
                    unit: 'hrs', 
                    unitPrice: laborRate * markup, 
                    total: retailLabor 
                }
            ]
        },
        metrics: {
            margin: ((grandTotal - totalHardCost) / grandTotal) * 100,
            totalSqFt,
            totalPerimeterFt,
            totalChars,
            totalHours
        }
    };
}

module.exports = { calculateChannelLetters };