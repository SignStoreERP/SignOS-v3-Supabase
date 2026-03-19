
import { CharacterRatios } from './types';

// Helvetica Bold (Approximation of Width/Height ratios)
const RATIOS: CharacterRatios = {
    // Uppercase
    'A': 0.72, 'B': 0.70, 'C': 0.70, 'D': 0.72, 'E': 0.65, 'F': 0.60, 
    'G': 0.75, 'H': 0.72, 'I': 0.20, 'J': 0.50, 'K': 0.70, 'L': 0.60, 
    'M': 0.88, 'N': 0.72, 'O': 0.75, 'P': 0.65, 'Q': 0.75, 'R': 0.70, 
    'S': 0.65, 'T': 0.60, 'U': 0.70, 'V': 0.65, 'W': 0.95, 'X': 0.65, 
    'Y': 0.65, 'Z': 0.60,

    // Numbers
    '0': 0.60, '1': 0.35, '2': 0.60, '3': 0.60, '4': 0.65, 
    '5': 0.60, '6': 0.60, '7': 0.60, '8': 0.60, '9': 0.60,

    // Punctuation
    ' ': 0.30, '.': 0.20, ',': 0.20, '-': 0.35, '!': 0.20
};

export const HelveticaBoldMetrics = {
    defaultRatio: 0.70,
    chars: RATIOS
};
