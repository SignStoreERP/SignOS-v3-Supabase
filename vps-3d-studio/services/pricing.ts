
import { SignConfig, IlluminationType, MountType } from '../types';
import { FONT_LIBRARY } from '../constants';

export interface PricingItem {
  id: string;
  category: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface PricingQuote {
  items: PricingItem[];
  subtotal: number;
  tax: number;
  total: number;
  requiresQuote: boolean; // New flag
}

export const calculateRetailPrice = (config: SignConfig): PricingQuote => {
  const items: PricingItem[] = [];
  let requiresQuote = false;
  
  // 1. Determine Pricing Tier based on Illumination and Font Style
  const fontData = FONT_LIBRARY[config.fontFamily] || Object.values(FONT_LIBRARY)[0];
  const isSerif = fontData.style === 'serif';
  
  let baseRate = 0;
  let tierName = "";

  if (config.illumination === IlluminationType.FRONT_LIT) {
    baseRate = isSerif ? 18.00 : 16.00;
    tierName = `Front Lighted (${isSerif ? 'Serif' : 'Block'})`;
  } else if (config.illumination === IlluminationType.HALO_LIT) {
    baseRate = isSerif ? 35.00 : 32.00;
    tierName = `Reverse Halo (Lit) (${isSerif ? 'Serif' : 'Block'})`;
  } else if (config.illumination === IlluminationType.DUAL_LIT) {
    // Custom logic for Dual Lit (Premium)
    baseRate = isSerif ? 48.00 : 45.00; 
    tierName = `Dual Lit (Front + Halo) (${isSerif ? 'Serif' : 'Block'})`;
  } else {
    // Non-Illuminated
    baseRate = isSerif ? 31.00 : 28.00;
    tierName = `Reverse Halo (Non-Lit) (${isSerif ? 'Serif' : 'Block'})`;
  }

  // 2. Calculate Letters
  // Pricing is Per Inch of Height
  const letterHeight = config.dimensions.height;
  
  config.lines.forEach((line, idx) => {
    if (!line) return;
    const charCount = line.replace(/\s/g, '').length; // Count non-whitespace
    const totalInches = charCount * letterHeight;
    
    items.push({
      id: `LINE-${idx + 1}`,
      category: 'Channel Letters',
      description: `Line ${idx + 1}: "${line}" (${charCount} chars @ ${letterHeight}") - ${tierName}`,
      qty: totalInches,
      unit: 'inch',
      unitPrice: baseRate,
      total: totalInches * baseRate
    });
  });

  // 3. Raceway Pricing
  if (config.mount === MountType.RACEWAY) {
    let totalLengthFt = 0;
    const widthFactor = fontData.widthFactor;
    
    config.lines.forEach((line, idx) => {
      if(!line) return;
      // Get length in inches, convert to feet
      const lenInches = config.dimensions.racewayLengths[idx] || (line.length * letterHeight * widthFactor);
      totalLengthFt += (lenInches / 12);
    });
    
    const billableFt = Math.ceil(totalLengthFt);
    
    items.push({
      id: 'RACEWAY',
      category: 'Mounting',
      description: 'Raceway Mount (Includes Paint & Safety Switch)',
      qty: billableFt,
      unit: 'ft',
      unitPrice: 95.00,
      total: billableFt * 95.00
    });
  }

  // 4. Backer Pricing (If Backer Panel Selected)
  if (config.mount === MountType.BACKER) {
      // Calculate Total Area
      // Width = calculatedWidth, Height = (lines * height) + gaps
      const w = config.dimensions.calculatedWidth;
      const h = (config.lines.length * config.dimensions.height) + ((config.lines.length - 1) * (config.dimensions.lineSpacing || 5));
      
      // Add margin for "Cloud" or Panel (e.g., 3 inches all around)
      const areaSqFt = ((w + 6) * (h + 6)) / 144;
      const billableSqFt = Math.ceil(areaSqFt);

      // Base Backer Price (Includes Paint & Routing)
      items.push({
          id: 'BACKER',
          category: 'Mounting',
          description: `ACM Backer - Routed, Painted (${config.colors.backer})`,
          qty: billableSqFt,
          unit: 'sqft',
          unitPrice: 25.00,
          total: billableSqFt * 25.00
      });

      // Add-on for Backer Halo Illumination (If specifically requested as a feature separate from letter halo)
      if (config.backerLit) {
          items.push({
             id: 'BACKER-LED',
             category: 'Illumination',
             description: 'Backer Panel Halo Illumination (Add-on)',
             qty: billableSqFt,
             unit: 'sqft',
             unitPrice: 15.00,
             total: billableSqFt * 15.00
          });
      }
  }

  // Check for complex combinations requiring custom quote
  if (config.illumination === IlluminationType.DUAL_LIT) {
      items.push({
          id: 'NOTE-1',
          category: 'Notice',
          description: 'Pricing for Dual Lit is an estimate. Sales Quote Required.',
          qty: 1,
          unit: 'ea',
          unitPrice: 0,
          total: 0
      });
      requiresQuote = true;
  }

  // Calculate Totals
  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const tax = subtotal * 0.0825; // 8.25% generic tax
  const total = subtotal + tax;

  return { items, subtotal, tax, total, requiresQuote };
};
