

import { FontData } from './types';

// CDN Paths for standard Three.js fonts
const CDN_BASE = 'https://threejs.org/examples/fonts';

export const FONT_LIBRARY: Record<string, FontData> = {
  "helvetiker_bold": {
    name: "Helvetica Bold",
    font: `${CDN_BASE}/helvetiker_bold.typeface.json`,
    widthFactor: 0.8,
    style: 'sans',
    cssFamily: "Helvetica, Arial, sans-serif",
    cssWeight: "bold",
    metrics: {
        defaultRatio: 0.8,
        chars: {
            'I': 0.3, '1': 0.3, 'l': 0.3, 'i': 0.3,
            'M': 1.0, 'W': 1.0, 'm': 1.0, 'w': 1.0
        }
    }
  },
  "helvetiker_regular": {
    name: "Helvetica Regular",
    font: `${CDN_BASE}/helvetiker_regular.typeface.json`,
    widthFactor: 0.75,
    style: 'sans',
    cssFamily: "Helvetica, Arial, sans-serif",
    cssWeight: "normal",
    metrics: {
        defaultRatio: 0.75,
        chars: {
            'I': 0.25, '1': 0.3, 'l': 0.25, 'i': 0.25,
            'M': 0.9, 'W': 0.9, 'm': 0.9, 'w': 0.9
        }
    }
  },
  "optimer_bold": {
    name: "Optimer Bold",
    font: `${CDN_BASE}/optimer_bold.typeface.json`,
    widthFactor: 0.85,
    style: 'sans',
    cssFamily: "Optima, sans-serif",
    cssWeight: "bold",
    metrics: {
        defaultRatio: 0.85,
        chars: {
             'I': 0.3, '1': 0.3, 'M': 1.0, 'W': 1.0
        }
    }
  },
  "gentilis_bold": {
    name: "Gentilis Bold",
    font: `${CDN_BASE}/gentilis_bold.typeface.json`,
    widthFactor: 0.82,
    style: 'serif',
    cssFamily: "Georgia, serif",
    cssWeight: "bold",
    metrics: {
        defaultRatio: 0.82,
        chars: {
             'I': 0.3, '1': 0.3, 'M': 1.0, 'W': 1.0
        }
    }
  },
  "droid_sans_bold": {
    name: "Droid Sans Bold",
    font: `${CDN_BASE}/droid/droid_sans_bold.typeface.json`,
    widthFactor: 0.8,
    style: 'sans',
    cssFamily: "sans-serif",
    cssWeight: "bold",
    metrics: {
        defaultRatio: 0.8,
        chars: {
             'I': 0.3, '1': 0.3, 'M': 1.0, 'W': 1.0
        }
    }
  }
};