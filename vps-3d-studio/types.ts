


// Enums for Categorization
export enum SignType {
  CHANNEL_LETTER = 'Channel Letter',
  CABINET = 'Light Box / Cabinet',
}

export enum IlluminationType {
  FRONT_LIT = 'Front Lit',
  HALO_LIT = 'Halo Lit',
  DUAL_LIT = 'Front & Halo Lit', // Added
  NON_ILLUMINATED = 'Non-Illuminated',
}

export enum MountType {
  DIRECT = 'Direct / Flush Mount',
  RACEWAY = 'Raceway',
  BACKER = 'Backer Panel',
}

export enum BackerShape {
  RECTANGLE = 'Rectangle',
  CONTOUR = 'Contour / Cloud',
}

export enum TextAlignment {
  LEFT = 'Left',
  CENTER = 'Center',
  RIGHT = 'Right',
}

export enum LEDColor {
  WHITE = 'White (6500K)',
  RED = 'Red',
  BLUE = 'Blue',
  GREEN = 'Green',
  YELLOW = 'Yellow',
}

export enum WallTexture {
  NONE = 'Smooth / Drywall',
  BRICK = 'Brick',
  STUCCO = 'Stucco',
  WOOD = 'Wood Siding',
  CORRUGATED = 'Corrugated Metal',
}

export enum Department {
  SALES = 'Sales',
  DESIGN = 'Design',
  ROUTER = 'CNC Router',
  METAL_FAB = 'Metal Fabrication',
  CHANNEL_BENDER = 'Channel Bender',
  PAINT = 'Paint',
  VINYL = 'Vinyl & Print',
  ASSEMBLY = 'Assembly',
  QC = 'Quality Control',
  INSTALL = 'Installation',
}

export enum FaceMaterial {
  ACRYLIC = 'Acrylic',
  POLYCARBONATE = 'Polycarbonate',
}

export type Thickness = 0.1875 | 0.25; // 3/16" or 1/4"

export enum BackerMaterial {
  ACM = '3mm ACM', // Standard for Front Lit
  ACRYLIC = 'Acrylic',
  POLYCARBONATE = 'Polycarbonate',
}

// 1. The Sign Configuration (Master Input)
export interface SignConfig {
  type: SignType;
  lines: string[]; // [Line1, Line2, Line3]
  alignment: TextAlignment;
  dimensions: {
    height: number; // inches (Input)
    depth: number; // inches (Input)
    calculatedWidth: number; // inches (Derived)
    racewayOffset: number; // inches (Vertical adjustment)
    racewayLengths: number[]; // inches (Manual override per line)
    racewayLengthsAuto: boolean[]; // toggle per line
    standoff: number; // inches (Backer to Wall OR Letter to Wall)
    letterStandoff: number; // inches (Letter to Backer) -- NEW
    lineSpacing: number; // inches (Gap between lines)
  };
  illumination: IlluminationType;
  ledColor: LEDColor;
  mount: MountType;
  wallTexture: WallTexture;
  wallColor: string;
  
  backerLit: boolean; // NEW: Does the backer panel itself have halo LEDs?
  backerShape: BackerShape; // NEW
  backerPadding: number; // NEW: Offset/Margin in inches

  colors: {
    vinylSeries: string; // e.g. "Oracal 8800"
    face: string; // Specific Color Name
    return: string; // References RETURN_COLORS name
    trimCap: string; // References TRIM_CAP_COLORS name
    raceway: string; // References PAINT_COLORS name
    backer: string; // References PAINT_COLORS name -- NEW
  };
  fontFamily: string; // Now references keys in FONT_LIBRARY
  
  // New Engineering Props
  faceMaterial: FaceMaterial;
  faceThickness: Thickness;
  backerMaterial: BackerMaterial; // For Halo or as general backer
  backerThickness: Thickness;
}

// 2. Site Survey Data (Install Conditions)
export interface SiteSurveyData {
  installHeight: number; // feet
  wallType: 'Brick' | 'Dryvit' | 'Wood' | 'Glass' | 'Steel';
  accessType: 'Ladder' | 'Bucket Truck' | 'Crane' | 'Scaffold';
  powerAccess: 'Behind Wall' | 'Remote' | 'Existing J-Box';
  permitRequired: boolean;
  notes: string;
}

// 3. BOM Item
export interface BOMItem {
  sku: string;
  name: string;
  quantity: number;
  unit: 'ft' | 'sqft' | 'ea' | 'sheet' | 'module' | 'set';
  department: Department;
  cost?: number;
}

// 4. Manufacturing Packet (Work Orders)
export interface ManufacturingPacket {
  id: string;
  generatedAt: string;
  config: SignConfig;
  warnings: string[];
  tasks: {
    department: Department;
    description: string;
    status: 'Pending' | 'In Progress' | 'Complete';
    estimatedHours: number;
  }[];
  bom: BOMItem[];
  vectorFiles: {
    routerFace: string; // SVG path
    routerBack: string;
    benderPath: string; // Simplified centerline for bender
    pattern: string;
  };
}
