// VIR_AGENT_PRNT: Flatbed Print Strategist
// Protocol 6626: Media Optimization and Nested Feed Logic

export const Agent_Flatbed_Print = {
    calculatePrintTime: (w: number, h: number, qty: number, speedLfHr: number, sides: number, maxBedWidth: number = 60) => {
        
        // Orientation 1: Standard (W across the bed, H feeds through)
        const fitAcrossW = Math.floor(maxBedWidth / w);
        const rowsW = Math.ceil(qty / Math.max(1, fitAcrossW));
        const lfStandard = (rowsW * h) / 12;

        // Orientation 2: Rotated (H across the bed, W feeds through)
        const fitAcrossH = Math.floor(maxBedWidth / h);
        const rowsH = Math.ceil(qty / Math.max(1, fitAcrossH));
        const lfRotated = (rowsH * w) / 12;

        // Agent chooses the most efficient linear feed
        let bestLF = lfStandard;
        let logicStr = `Nested ${Math.max(1, fitAcrossW)} across.`;
        
        if (lfRotated < lfStandard) {
            bestLF = lfRotated;
            logicStr = `Rotated & Nested ${Math.max(1, fitAcrossH)} across.`;
        }

        // Calculate final optimized hours
        const printHrs = (bestLF / speedLfHr) * sides;

        return {
            printHrs: printHrs,
            nestedLF: bestLF,
            logic: logicStr
        };
    }
};