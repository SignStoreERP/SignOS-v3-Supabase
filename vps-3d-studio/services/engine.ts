
import {
  SignConfig,
  ManufacturingPacket,
  Department,
  SignType,
  MountType,
  BOMItem,
  IlluminationType,
  BackerMaterial
} from '../types';
import { 
  calculatePerimeter, 
  generateBenderPath, 
  calculateTotalWidth,
  calculateSheetsNeeded,
  calculateLEDModules
} from './vectorUtils';
import { FONT_LIBRARY } from '../constants';

export const calculateSignRequirements = (config: SignConfig): ManufacturingPacket => {
  const tasks = [];
  const bom: BOMItem[] = [];
  const warnings = [];

  // Robust Fallback for Engine
  const fontData = FONT_LIBRARY[config.fontFamily as keyof typeof FONT_LIBRARY] || Object.values(FONT_LIBRARY)[0];

  // Update calculated width if not present (although UI usually handles this, we double check here)
  const calcWidth = calculateTotalWidth(config.lines, config.dimensions.height, config.fontFamily);
  const effectiveConfig = { ...config, dimensions: { ...config.dimensions, calculatedWidth: calcWidth }};

  // 1. Engineering Checks
  // Raceway Splicing Check - Check if ANY section exceeds 120"
  if (effectiveConfig.mount === MountType.RACEWAY) {
    let spliceNeeded = false;
    const widthFactor = fontData.widthFactor;

    config.lines.forEach((line, idx) => {
      // Use the accurate length stored in config (which comes from 3D measure), fallback to estimation
      const len = config.dimensions.racewayLengths[idx] || (line.length * (config.dimensions.height * widthFactor));
      
      if(len > 120) spliceNeeded = true;
    });

    if (spliceNeeded) {
      warnings.push(`Raceway length exceeds 10ft on one or more lines. Will be built in sections with splice plates.`);
    }
  }

  // 2. Core Logic Branching (Strategy Pattern)
  if (effectiveConfig.type === SignType.CHANNEL_LETTER) {
    
    // --- CNC Router Logic ---
    const facesNeeded = calculateSheetsNeeded(config.lines, config.dimensions.height);
    const backsNeeded = facesNeeded; // Usually same amount for backs
    
    // Face Material BOM
    const faceMatName = `${config.faceMaterial} ${config.faceThickness}" - Translucent White`;
    bom.push({ sku: `SHEET-${config.faceMaterial.substring(0,3).toUpperCase()}`, name: faceMatName, quantity: facesNeeded, unit: 'sheet', department: Department.ROUTER });

    // Backer Material BOM
    let backMatName = "3mm ACM - White";
    let backSku = "ACM-WHT";
    
    if (config.illumination === IlluminationType.HALO_LIT) {
        // Use user selected backer for Halo
        const bThickness = config.backerThickness || 0.1875;
        backMatName = `${config.backerMaterial} ${bThickness}"`;
        backSku = `SHEET-${config.backerMaterial.substring(0,3).toUpperCase()}`;
    } else {
        // Force ACM for front lit usually, unless overridden, but here we respect config if user selected
        // In Controls we enforce BackerMaterial.ACM for Front Lit, so this is safe
        backMatName = `${config.backerMaterial}`;
    }

    bom.push({ sku: backSku, name: backMatName, quantity: backsNeeded, unit: 'sheet', department: Department.ROUTER });
    
    tasks.push({ department: Department.ROUTER, description: `Route ${facesNeeded} sheets of Faces`, status: 'Pending', estimatedHours: facesNeeded * 0.75 });
    tasks.push({ department: Department.ROUTER, description: `Route ${backsNeeded} sheets of Backers`, status: 'Pending', estimatedHours: backsNeeded * 0.5 });

    // --- Vinyl Logic ---
    // User selected Series + Color. In production, we assume we wrap the face.
    tasks.push({ department: Department.VINYL, description: `Apply ${config.colors.vinylSeries} (${config.colors.face}) to faces`, status: 'Pending', estimatedHours: 1.5 });
    bom.push({ sku: 'VNY-TRN', name: `${config.colors.vinylSeries} - ${config.colors.face}`, quantity: facesNeeded * 32, unit: 'sqft', department: Department.VINYL });

    // --- Coil & Trim Logic ---
    const totalPerimeterInches = calculatePerimeter(config.lines, config.dimensions.height);
    bom.push({ sku: 'COIL-5', name: `Return Coil 5" - ${config.colors.return}`, quantity: Math.ceil(totalPerimeterInches / 12), unit: 'ft', department: Department.CHANNEL_BENDER });
    bom.push({ sku: 'TRIM-1', name: `Trim Cap 1" - ${config.colors.trimCap}`, quantity: Math.ceil(totalPerimeterInches / 12), unit: 'ft', department: Department.ASSEMBLY });
    
    tasks.push({ department: Department.CHANNEL_BENDER, description: `Bend Returns (Total: ${Math.ceil(totalPerimeterInches/12)} ft)`, status: 'Pending', estimatedHours: 2 });
    tasks.push({ department: Department.ASSEMBLY, description: `Bond Trim Cap to Faces`, status: 'Pending', estimatedHours: 2.5 });

    // --- Illumination Logic (LED & PSU) ---
    if (config.illumination !== IlluminationType.NON_ILLUMINATED) {
      const totalModules = calculateLEDModules(config.lines, config.dimensions.height);
      const totalWatts = totalModules * 0.45;
      
      bom.push({ sku: `LED-${config.ledColor.toUpperCase()}`, name: `LED Module (${config.ledColor})`, quantity: totalModules, unit: 'module', department: Department.ASSEMBLY });
      
      // PSU Calculation
      if (totalWatts <= 60) {
        bom.push({ sku: 'PSU-60W', name: 'Power Supply 60W 12V', quantity: 1, unit: 'ea', department: Department.ASSEMBLY });
      } else if (totalWatts <= 120) {
        bom.push({ sku: 'PSU-120W', name: 'Power Supply 120W 12V', quantity: 1, unit: 'ea', department: Department.ASSEMBLY });
      } else {
        const psuCount = Math.ceil(totalWatts / 120);
        bom.push({ sku: 'PSU-120W', name: 'Power Supply 120W 12V', quantity: psuCount, unit: 'ea', department: Department.ASSEMBLY });
      }

      tasks.push({ department: Department.ASSEMBLY, description: `Install ${totalModules} LEDs & Wiring`, status: 'Pending', estimatedHours: 2 });
    }

    // --- Mounting Logic (Raceway vs Direct) ---
    if (config.mount === MountType.RACEWAY) {
      // Calculate total raceway length by summing individual line widths based on configuration
      let totalRwLen = 0;
      const widthFactor = fontData.widthFactor;

      config.lines.forEach((line, idx) => {
         if(line.length > 0) {
            // Priority: Config Value (Synced from 3D) > Estimation
            const len = config.dimensions.racewayLengths[idx] || (line.length * (config.dimensions.height * widthFactor));
            totalRwLen += len;
         }
      });
      
      const numLines = config.lines.filter(l => l.length > 0).length;
      
      // Metal Fab
      tasks.push({ department: Department.METAL_FAB, description: `Fabricate ${numLines}x Raceway Runs (Total: ${Math.ceil(totalRwLen)}") w/ End Caps & Clips`, status: 'Pending', estimatedHours: 3 });
      // STRICT: 6x4 Extrusion
      bom.push({ sku: 'RAC-EXT-64', name: `Raceway Extrusion 6"x4" - ${Math.ceil(totalRwLen)}" total`, quantity: Math.ceil(totalRwLen / 120), unit: 'ea', department: Department.METAL_FAB });
      bom.push({ sku: 'RAC-CLIP', name: 'Mounting Clips', quantity: (Math.ceil(totalRwLen / 48) + 1) * numLines, unit: 'ea', department: Department.METAL_FAB });
      bom.push({ sku: 'RAC-CAP', name: 'Raceway End Caps', quantity: 2 * numLines, unit: 'ea', department: Department.METAL_FAB });
      
      // Paint
      tasks.push({ department: Department.PAINT, description: `Paint Raceways (${config.colors.raceway})`, status: 'Pending', estimatedHours: 3 });
      bom.push({ sku: 'PNT-EXT', name: `Paint - ${config.colors.raceway}`, quantity: 1, unit: 'ea', department: Department.PAINT });

      // Assembly (Install + Switch)
      tasks.push({ department: Department.ASSEMBLY, description: 'Mount Letters to Raceway & Install Switch', status: 'Pending', estimatedHours: 2 });
      bom.push({ sku: 'SW-TOGGLE', name: 'Safety Disconnect Switch (UL)', quantity: 1, unit: 'ea', department: Department.ASSEMBLY });
    } else {
      // Direct Mount
      tasks.push({ department: Department.DESIGN, description: 'Plot Installation Pattern', status: 'Pending', estimatedHours: 0.5 });
      bom.push({ sku: 'PAT-PAPER', name: 'Pattern Paper', quantity: Math.ceil(calcWidth / 12), unit: 'ft', department: Department.DESIGN });
    }

  } else if (config.type === SignType.CABINET) {
    // Cabinet Logic (Simplified for this update, maintaining basic calculation)
    tasks.push({ department: Department.METAL_FAB, description: "Weld Cabinet Frame", status: 'Pending', estimatedHours: 4 });
    bom.push({ sku: 'ALU-EXT-CAB', name: 'Cabinet Extrusion', quantity: (config.dimensions.height + calcWidth) * 2 / 12, unit: 'ft', department: Department.METAL_FAB });
  }

  return {
    id: `WO-${Math.floor(Math.random() * 90000) + 10000}`,
    generatedAt: new Date().toISOString(),
    config: effectiveConfig,
    warnings,
    tasks,
    bom,
    vectorFiles: {
      routerFace: `face_cut_file.svg`,
      routerBack: `back_cut_file.svg`,
      benderPath: `bender_data.dxf`,
      pattern: config.mount === MountType.DIRECT ? `install_pattern.svg` : 'N/A',
    }
  };
};
