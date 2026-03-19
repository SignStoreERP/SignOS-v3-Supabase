
import { SignType, IlluminationType, MountType, TextAlignment, LEDColor, WallTexture, FaceMaterial, BackerMaterial, SignConfig, BackerShape } from './types';
export { RETURN_COLORS, TRIM_CAP_COLORS, PAINT_COLORS, VINYL_SERIES } from './data/materials';
export { FONT_LIBRARY } from './data/fonts/index';

export const STOCK_SHEET_SIZES = {
  standard: { width: 96, height: 48 }, // 4x8
  oversize: { width: 120, height: 60 }, // 5x10
};

// Factory function to ensure we always get a fresh, unmutated object
export const getDefaultConfig = (): SignConfig => ({
  type: SignType.CHANNEL_LETTER,
  lines: ["SIGN STORE", "", ""],
  alignment: TextAlignment.CENTER,
  dimensions: { 
    height: 24, 
    depth: 5, 
    calculatedWidth: 0, 
    racewayOffset: 0, 
    standoff: 2, // Default Wall Standoff
    letterStandoff: 0.5, // Default Letter to Backer
    racewayLengths: [204, 204, 204],
    racewayLengthsAuto: [true, true, true],
    lineSpacing: 5, // Default ~20% of 24"
  },
  illumination: IlluminationType.FRONT_LIT,
  ledColor: LEDColor.WHITE,
  mount: MountType.RACEWAY,
  wallTexture: WallTexture.NONE,
  wallColor: "#E3E4E1", // SW 6252 Ice Cube
  backerLit: false,
  backerShape: BackerShape.CONTOUR,
  backerPadding: 2.0,
  colors: {
    vinylSeries: "Oracal 8800 Translucent",
    face: "031 Red", 
    return: "Gloss Black",
    trimCap: '1" Black',
    raceway: "#9c9b91",
    backer: "SW 6258 Tricorn Black",
  },
  fontFamily: "helvetiker_bold",
  
  faceMaterial: FaceMaterial.ACRYLIC,
  faceThickness: 0.1875 as const,
  backerMaterial: BackerMaterial.ACM,
  backerThickness: 0.1875 as const,
});

// For backward compatibility if needed, but App should use getDefaultConfig()
export const DEFAULT_CONFIG = getDefaultConfig();

export const SAMPLE_SURVEY = {
  installHeight: 15,
  wallType: "Brick" as const,
  accessType: "Bucket Truck" as const,
  powerAccess: "Behind Wall" as const,
  permitRequired: true,
  notes: "South facing wall, high wind load zone.",
};
