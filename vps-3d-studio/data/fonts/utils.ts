
import { CharacterRatios } from './types';

// Helper to quickly generate a metrics object with a default ratio.
// This is used for new fonts before they have been calibrated in the 3D tool.
export const createMetrics = (defaultRatio: number) => {
    return {
        defaultRatio,
        chars: {} as CharacterRatios
    };
};

// Helper to guess width factor based on filename tags
export const estimateWidthFactor = (name: string): number => {
    const n = name.toLowerCase();
    if (n.includes('cond') || n.includes('narrow') || n.includes('impact') || n.includes('compressed')) return 0.65;
    if (n.includes('ext') || n.includes('wide') || n.includes('expanded')) return 1.15;
    if (n.includes('mono') || n.includes('code')) return 0.6;
    return 0.85; // Standard Sans/Serif average
};
