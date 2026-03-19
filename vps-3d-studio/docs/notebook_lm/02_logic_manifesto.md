# 02: The Logic Manifesto (Engine & Pricing)

This document outlines the mathematical and logical rules used to transform a design configuration into a Bill of Materials (BOM) and a retail price.

## 1. Engineering Engine (`engine.ts`)

The engine calculates material requirements based on the `SignConfig`.

### Perimeter & Coil Calculation
- **Formula:** `Perimeter = CharacterCount * Height * FontPerimeterFactor`
- The `fontPerimeterFactor` varies by font (Serif fonts have higher perimeters).
- **Output:** Total linear feet of Return Coil and Trim Cap needed.

### Sheet Material Calculation (Faces & Backs)
- **Logic:** Uses a nesting estimation based on character count and height.
- **Standard Size:** Assumes 4'x8' (48"x96") sheets.
- **Output:** Number of sheets of Acrylic (faces) and ACM (backs) required.

### Illumination (LEDs & Power)
- **LED Modules:** Calculated based on the surface area of the letters.
- **Power Consumption:** Each module is estimated at 0.45 Watts.
- **PSU Selection:** 
    - < 60W → 1x 60W Power Supply
    - 60W - 120W → 1x 120W Power Supply
    - \> 120W → Multiple 120W Power Supplies (TotalWatts / 120)

### Raceway Fabrication
- **Standard Size:** 6"x4" Aluminum Extrusion.
- **Length:** Sum of the widths of each line of text plus end caps.
- **Splice Rule:** Any run over 120" (10ft) triggers a "Splice Plate" warning.

---

## 2. Pricing Service (`pricing.ts`)

Pricing is calculated using a "Tiered Rate" model based on complexity.

### Base Rates (Per Inch of Height)
The system calculates `Total Inches = (Sum of Characters) * LetterHeight`.

| Illumination Type | Block Font Rate | Serif Font Rate |
|-------------------|-----------------|-----------------|
| Front Lit         | $16.00          | $18.00          |
| Halo Lit          | $32.00          | $35.00          |
| Dual Lit          | $45.00          | $48.00          |
| Non-Illuminated   | $28.00          | $31.00          |

*Note: Non-illuminated is often priced higher than front-lit because it typically involves more expensive "Reverse Halo" construction without the LEDs.*

### Mounting Add-ons
- **Raceway:** $95.00 per linear foot (includes fabrication, paint, and UL switch).
- **Backer Panel:** $25.00 per square foot (includes routing and paint).
- **Backer Halo:** $15.00 per square foot (additional LED labor/material).

### Tax & Totals
- **Tax Rate:** 8.25% (Standard default).
- **Quote Flag:** If `IlluminationType` is `DUAL_LIT`, the system sets `requiresQuote = true` to signal that a human should review the automated estimate.

## Usage in NotebookLM
- Use these rules to build **Supabase Edge Functions** that validate pricing on the server.
- Use the BOM logic to predict inventory needs based on the current pipeline of quotes in your database.
