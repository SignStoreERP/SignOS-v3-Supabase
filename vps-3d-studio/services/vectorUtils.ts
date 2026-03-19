
// In a real app, this would use paper.js or maker.js.
// Here we simulate the logic for calculating bender paths and perimeters.

import { FONT_LIBRARY } from '../data/fonts/index';
import { FontData } from '../data/fonts/types';

// New Helper: Get character width ratio
const getCharWidthRatio = (char: string, font: FontData): number => {
  const upperChar = char.toUpperCase();
  // Check specific table, then fallback
  return font.metrics.chars[upperChar] || font.metrics.defaultRatio;
};

// Helper: robustly get font or default
const getFontOrFallback = (fontName: string): FontData => {
    return FONT_LIBRARY[fontName] || Object.values(FONT_LIBRARY)[0];
};

export const calculatePreciseLineWidth = (line: string, height: number, fontName: string): number => {
    const font = getFontOrFallback(fontName);
    let width = 0;
    for (let i = 0; i < line.length; i++) {
        width += height * getCharWidthRatio(line[i], font);
    }
    // Add simple kerning estimate (5% of height per character gap)
    if (line.length > 1) {
        width += (line.length - 1) * (height * 0.05); 
    }
    return width;
};

// Calculate width based on font and text content
export const calculateTotalWidth = (lines: string[], height: number, fontName: string): number => {
  let maxWidth = 0;
  lines.forEach(line => {
    if(!line) return;
    const lineWidth = calculatePreciseLineWidth(line, height, fontName);
    if (lineWidth > maxWidth) maxWidth = lineWidth;
  });
  return Math.ceil(maxWidth);
};

// New Helper: Calculate Raceway Length based on Tuck
// Raceway should start at the horizontal CENTER of the first letter
// And end at the horizontal CENTER of the last letter
export const calculateRacewayTuckLength = (line: string, height: number, fontName: string): number => {
    if (line.length === 0) return 0;
    const font = getFontOrFallback(fontName);
    
    // 1. Calculate Full Visual Width
    const totalWidth = calculatePreciseLineWidth(line, height, fontName);

    // 2. Get Width of First and Last characters
    const firstCharW = height * getCharWidthRatio(line[0], font);
    const lastCharW = height * getCharWidthRatio(line[line.length-1], font);

    // 3. Raceway Length = Total Width - Half First - Half Last
    // This effectively places the start point at center of First, and end point at center of Last
    const rwLen = totalWidth - (firstCharW / 2) - (lastCharW / 2);
    
    return Math.max(height, rwLen); // Ensure it's at least as wide as height (sanity check)
};

export const generateBenderPath = (text: string, height: number): string => {
  return `M0,0 L${height * 0.2},${height} L${height * 0.5},0 L${height * 0.8},${height} L${height},0 (Path for ${text})`;
};

export const calculatePerimeter = (lines: string[], height: number): number => {
  const charWidth = height * 0.6;
  const estimatedPerChar = (height * 2) + (charWidth * 2);
  let totalChars = 0;
  lines.forEach(l => totalChars += l.length);
  return totalChars * estimatedPerChar;
};

export const calculateSheetsNeeded = (lines: string[], height: number): number => {
  // 4x8 Sheet = 4608 sq inches
  const sheetArea = 48 * 96;
  
  // Estimate nesting area (box bounding + 10% waste)
  const areaPerChar = (height * (height * 0.75)) * 1.1;
  let totalChars = 0;
  lines.forEach(l => totalChars += l.length);
  
  const totalArea = totalChars * areaPerChar;
  return Math.max(1, Math.ceil(totalArea / sheetArea));
};

export const calculateLEDModules = (lines: string[], height: number): number => {
  // Logic: Minimum 2 modules. Add 1 module for every 6" over 12" height.
  // Base: 12" height = 2 modules. 18" = 3 modules. 24" = 4 modules.
  const extraHeight = Math.max(0, height - 12);
  const additionalModules = Math.ceil(extraHeight / 6);
  const modulesPerLetter = 2 + additionalModules;
  
  let totalChars = 0;
  lines.forEach(l => totalChars += l.length);
  
  return totalChars * modulesPerLetter;
};

export const checkSeamRequired = (width: number, height: number): string | null => {
  if (width > 120) {
    return "WARNING: Raceway exceeds 120\". Splicing required.";
  }
  return null;
};
