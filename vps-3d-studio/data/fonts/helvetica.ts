
import { CharacterRatios } from './types';

// Helvetica Standard (Narrower than bold)
const RATIOS: CharacterRatios = {
    // Uppercase
    'A': 0.65, 'B': 0.65, 'C': 0.65, 'D': 0.68, 'E': 0.60, 'F': 0.55, 
    'G': 0.70, 'H': 0.68, 'I': 0.18, 'J': 0.45, 'K': 0.65, 'L': 0.55, 
    'M': 0.82, 'N': 0.68, 'O': 0.70, 'P': 0.60, 'Q': 0.70, 'R': 0.65, 
    'S': 0.60, 'T': 0.55, 'U': 0.65, 'V': 0.60, 'W': 0.90, 'X': 0.60, 
    'Y': 0.60, 'Z': 0.55,
    
    // Numbers
    '0': 0.55, '1': 0.30, '2': 0.55, '3': 0.55, '4': 0.60, 
    '5': 0.55, '6': 0.55, '7': 0.55, '8': 0.55, '9': 0.55,

    // Punctuation
    ' ': 0.25, '.': 0.15, ',': 0.15, '-': 0.30, '!': 0.15
};

export const HelveticaMetrics = {
    defaultRatio: 0.65,
    chars: RATIOS
};
