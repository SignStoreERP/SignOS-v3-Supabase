import { VINYL_SERIES } from '../../constants';
import { LEDColor } from '../../types';

export interface PartVisibility {
  faces: boolean;
  trimCapSides: boolean;
  trimCapFaces: boolean;
  returns: boolean;
  backers: boolean;
  raceway: boolean;
}

export const getHex = (name: string, collection: {name: string, hex: string}[]) => {
  const found = collection.find(c => c.name === name);
  return found ? found.hex : '#333333';
};

export const getVinylHex = (series: string, name: string) => {
  const collection = VINYL_SERIES[series as keyof typeof VINYL_SERIES];
  if(!collection) return '#FFFFFF';
  return getHex(name, collection);
};

export const getMaterialProps = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('anodized') || n.includes('silver') || n.includes('aluminum') || n.includes('gold') || n.includes('bronze') || n.includes('metallic') || n.includes('brite')) {
    // Metallic / Anodized
    return { roughness: 0.3, metalness: 0.8 }; 
  }
  if (n.includes('gloss')) {
    // High Gloss Paint
    return { roughness: 0.1, metalness: 0.1 };
  }
  if (n.includes('matte')) {
    // Matte Paint
    return { roughness: 0.8, metalness: 0.0 };
  }
  // Standard Satin/Semigloss Paint
  return { roughness: 0.4, metalness: 0.1 };
};

export const LED_HEX_MAP: Record<LEDColor, string> = {
  [LEDColor.WHITE]: '#D4EBFF',
  [LEDColor.RED]: '#FF0000',
  [LEDColor.BLUE]: '#0033FF',
  [LEDColor.GREEN]: '#00FF00',
  [LEDColor.YELLOW]: '#FFCC00',
};