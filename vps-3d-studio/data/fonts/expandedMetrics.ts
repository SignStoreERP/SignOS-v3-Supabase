
import { CharacterRatios } from './types';
import { HelveticaBoldMetrics } from './helveticaBold';

// Helper to clone and adjust metrics
const adjust = (base: any, factor: number) => {
    const newChars: CharacterRatios = {};
    for (const [key, val] of Object.entries(base.chars)) {
        newChars[key] = Number(((val as number) * factor).toFixed(2));
    }
    return {
        defaultRatio: Number((base.defaultRatio * factor).toFixed(2)),
        chars: newChars
    };
};

// 1. Eurostyle / Michroma (Very Wide)
export const EurostyleMetrics = adjust(HelveticaBoldMetrics, 1.25);

// 2. Impact / Anton (Narrow/Condensed)
export const ImpactMetrics = adjust(HelveticaBoldMetrics, 0.75);

// 3. Avant Garde / Poppins (Round/Wide)
export const AvantGardeMetrics = adjust(HelveticaBoldMetrics, 1.1);

// 4. Futura / Jost (Geometric/Standard)
export const FuturaMetrics = adjust(HelveticaBoldMetrics, 0.95);

// 5. Arial Black / Roboto Black (Very Heavy/Wide)
export const ArialBlackMetrics = adjust(HelveticaBoldMetrics, 1.15);
