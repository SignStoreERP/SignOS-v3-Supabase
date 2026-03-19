
import { SignConfig, MountType, IlluminationType } from '../types';
import { TRIM_CAP_COLORS, RETURN_COLORS, PAINT_COLORS, VINYL_SERIES, FONT_LIBRARY } from '../constants';

const DIM_COLOR = "#3b82f6";

// Helpers
const getHex = (name: string, collection: {name: string, hex: string}[]) => {
  const found = collection.find(c => c.name === name);
  return found ? found.hex : '#cccccc';
};
const getVinylHex = (series: string, name: string) => {
  const collection = VINYL_SERIES[series as keyof typeof VINYL_SERIES];
  if(!collection) return '#cccccc';
  return getHex(name, collection);
};

// SVG Generators
const svgLine = (x1: number, y1: number, x2: number, y2: number, color: string, width: number, markerStart?: string, markerEnd?: string) => {
  const mStart = markerStart ? `marker-start="${markerStart}"` : '';
  const mEnd = markerEnd ? `marker-end="${markerEnd}"` : '';
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${mStart} ${mEnd} />`;
};

const svgRect = (x: number, y: number, w: number, h: number, fill: string, stroke: string, strokeWidth: number = 0) => {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
};

const svgText = (
  x: number, y: number, text: string, fontSize: number, fontFamily: string, fontWeight: string, color: string, 
  anchor: string = "middle", baseline: string = "middle", length?: number, rotation: number = 0, 
  stroke: string = "none", strokeWidth: number = 0, dy?: string
) => {
  const transform = rotation ? `transform="rotate(${rotation}, ${x}, ${y})"` : '';
  const lenAttr = length ? `textLength="${length}" lengthAdjust="spacingAndGlyphs"` : '';
  const strokeAttr = stroke !== 'none' ? `stroke="${stroke}" stroke-width="${strokeWidth}"` : '';
  const dyAttr = dy !== undefined ? dy : (baseline === 'middle' ? '0.32em' : '0');
  
  return `<text x="${x}" y="${y}" ${lenAttr} ${transform} dy="${dyAttr}" text-anchor="${anchor}" dominant-baseline="${baseline}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}" fill="${color}" ${strokeAttr}>${text}</text>`;
};

const svgDimensionLine = (x1: number, y1: number, x2: number, y2: number, offset: number, label: string, scale: number, textOffsetBase: number = 0, color: string = DIM_COLOR) => {
  const fontSize = 12;
  const sFontSize = fontSize * scale;
  const sStroke = 1 * scale; 
  const sGap = 5 * scale;
  const sExt = 8 * scale;
  const sTextOffset = textOffsetBase * scale;

  const isVertical = Math.abs(x1 - x2) < 0.1;
  const ex1_start_x = isVertical ? x1 + (offset > 0 ? sGap : -sGap) : x1;
  const ex1_start_y = isVertical ? y1 : y1 + (offset > 0 ? sGap : -sGap);
  const dim_x1 = isVertical ? x1 + offset : x1;
  const dim_y1 = isVertical ? y1 : y1 + offset;
  const dim_x2 = isVertical ? x2 + offset : x2;
  const dim_y2 = isVertical ? y2 : y2 + offset;
  const ex1_end_x = isVertical ? dim_x1 + (offset > 0 ? sExt : -sExt) : x1;
  const ex1_end_y = isVertical ? y1 : dim_y1 + (offset > 0 ? sExt : -sExt);
  const ex2_start_x = isVertical ? x2 + (offset > 0 ? sGap : -sGap) : x2;
  const ex2_start_y = isVertical ? y2 : y2 + (offset > 0 ? sGap : -sGap);
  const ex2_end_x = isVertical ? dim_x2 + (offset > 0 ? sExt : -sExt) : x2;
  const ex2_end_y = isVertical ? y2 : dim_y2 + (offset > 0 ? sExt : -sExt);

  const midX = (dim_x1 + dim_x2) / 2;
  const midY = (dim_y1 + dim_y2) / 2;
  let tX, tY;

  if (isVertical) {
      const dir = offset >= 0 ? 1 : -1;
      tX = midX + (sTextOffset * dir);
      tY = midY;
  } else {
      const dir = offset >= 0 ? 1 : -1;
      tX = midX;
      tY = midY + (sTextOffset * dir);
  }

  const rotation = isVertical ? -90 : 0;
  const textWidth = label.length * sFontSize * 0.6;
  const rectH = sFontSize * 1.2;
  const rx = tX - (textWidth/2);
  const ry = tY - (rectH/2);
  
  const rectTransform = `transform="rotate(${rotation}, ${tX}, ${tY})"`;
  const bgRect = `<rect x="${rx}" y="${ry}" width="${textWidth}" height="${rectH}" fill="white" opacity="0.9" ${rectTransform} />`;

  const markerColor = color === '#333' ? 'blk' : 'blue';

  return `
    ${svgLine(ex1_start_x, ex1_start_y, ex1_end_x, ex1_end_y, color, sStroke)}
    ${svgLine(ex2_start_x, ex2_start_y, ex2_end_x, ex2_end_y, color, sStroke)}
    ${svgLine(dim_x1, dim_y1, dim_x2, dim_y2, color, sStroke, `url(#arrow-start-${markerColor})`, `url(#arrow-end-${markerColor})`)}
    ${bgRect}
    ${svgText(tX, tY, label, sFontSize, "sans-serif", "normal", color, "middle", "middle", undefined, rotation)}
  `;
};

const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];
    const charWidth = fontSize * 0.6;
    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = (currentLine.length + 1 + word.length) * charWidth;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
};

// Generates the Full HTML Layout of the Blueprint
export const generateBlueprintHTML = (config: SignConfig): string => {
  const selectedFont = FONT_LIBRARY[config.fontFamily as keyof typeof FONT_LIBRARY] || Object.values(FONT_LIBRARY)[0];
  const widthFactor = selectedFont.widthFactor;
  const cssFamily = selectedFont.cssFamily || "sans-serif";
  const cssWeight = selectedFont.cssWeight || "normal";

  const letterHeight = config.dimensions.height;
  const letterDepth = config.dimensions.depth;
  const rowGap = config.dimensions.lineSpacing !== undefined ? config.dimensions.lineSpacing : (letterHeight * 0.2);
  
  // Elevation Dimensions
  let maxLineWidth = 0;
  config.lines.forEach((line, idx) => {
    if (!line) return;
    const textW = line.length * (letterHeight * widthFactor);
    let rowW = textW;
    if (config.mount === MountType.RACEWAY) {
        const rwLen = config.dimensions.racewayLengths[idx] || textW;
        if (rwLen > rowW) rowW = rwLen;
    }
    if (rowW > maxLineWidth) maxLineWidth = rowW;
  });

  const drawingTotalWidth = Math.max(maxLineWidth, config.dimensions.calculatedWidth);
  const numLines = config.lines.filter(l => l).length;
  const signAssemblyHeight = (numLines * letterHeight) + ((numLines - 1) * rowGap); 
  
  const viewportPadding = 48;
  const viewBoxWidth = drawingTotalWidth + (viewportPadding * 2);
  const dimScale = viewBoxWidth / 625;
  const racewayHeight = 6;
  const racewayDepth = 4;

  // Description
  const standardRaceway = PAINT_COLORS.find(c => c.name === config.colors.raceway);
  const racewayName = standardRaceway ? standardRaceway.name : config.colors.raceway;
  let descriptionLines: string[] = [];
  const descFontSize = 12 * dimScale;

  config.lines.forEach((line, idx) => {
      if(!line) return;
      const count = line.replace(/\s/g, '').length;
      let rwText = '';
      if (config.mount === MountType.RACEWAY) {
         const rwLen = config.dimensions.racewayLengths[idx] || (line.length * letterHeight * widthFactor);
         rwText = `, and ${Math.round(rwLen)}" raceway painted ${racewayName}`;
      }
      const desc = `(Line ${idx+1}: x${count}) ${letterHeight}" ${config.illumination} Channel Letters with ${config.colors.face} faces, ${config.colors.return} ${letterDepth}" returns, ${config.colors.trimCap.replace('1" ', '')} trim${rwText}.`;
      descriptionLines = [...descriptionLines, ...wrapText(desc, drawingTotalWidth, descFontSize)];
  });

  const descriptionBlockHeight = descriptionLines.length * (descFontSize * 1.4) + (24 * dimScale); 
  const totalContentHeight = signAssemblyHeight + descriptionBlockHeight;
  const viewBoxHeight = Math.max(totalContentHeight + (viewportPadding * 2), viewBoxWidth * 0.75); 

  // Colors
  const faceColor = getVinylHex(config.colors.vinylSeries, config.colors.face);
  const returnColor = getHex(config.colors.return, RETURN_COLORS);
  const trimColor = getHex(config.colors.trimCap, TRIM_CAP_COLORS);
  const racewayColor = standardRaceway ? standardRaceway.hex : (config.colors.raceway.startsWith('#') ? config.colors.raceway : '#333333');
  const clientName = config.lines[0] || "Client Name";

  // --- SVG 1: Elevation ---
  let elevationContent = '';
  config.lines.forEach((line, i) => {
    if(!line) return;
    const lineHeight = letterHeight + rowGap; 
    const y = i * lineHeight;
    const calculatedWidth = Math.max(0.1, line.length * (letterHeight * widthFactor));
    const x = (drawingTotalWidth - calculatedWidth) / 2;
    const rwLen = config.dimensions.racewayLengths[i] || calculatedWidth;
    const rwX = (drawingTotalWidth - rwLen) / 2;
    const visualFontSize = letterHeight * 1.35; 

    if (config.mount === MountType.RACEWAY) {
       const ry = y + (letterHeight/2) - (racewayHeight/2) + (config.dimensions.racewayOffset || 0);
       elevationContent += svgRect(rwX, ry, rwLen, racewayHeight, racewayColor, "#94a3b8", 0.5);
    }
    const tx = x + (calculatedWidth/2);
    const ty = y + (letterHeight/2);
    const strokeW = config.illumination === IlluminationType.HALO_LIT ? 0 : (letterHeight * 0.02);
    // Passing "0.1em" for dy to match BlueprintView.tsx exactly
    elevationContent += svgText(tx, ty, line, visualFontSize, cssFamily, cssWeight, faceColor, "middle", "middle", undefined, 0, trimColor, strokeW, "0.1em");
  });

  descriptionLines.forEach((textLine, idx) => {
     elevationContent += svgText(drawingTotalWidth/2, signAssemblyHeight + (48 * dimScale) + (idx * descFontSize * 1.4), textLine, descFontSize, "monospace", "normal", "#334155");
  });

  elevationContent += svgDimensionLine(0, 0, drawingTotalWidth, 0, -24 * dimScale, `${Math.round(drawingTotalWidth)}" (${Math.floor(drawingTotalWidth/12)}'-${Math.round(drawingTotalWidth%12)}")`, dimScale, 20);
  elevationContent += svgDimensionLine(0, 0, 0, signAssemblyHeight, -24 * dimScale, `${Math.round(signAssemblyHeight)}" (${Math.floor(signAssemblyHeight/12)}'-${Math.round(signAssemblyHeight%12)}")`, dimScale, 20);

  const elevationSVG = `
    <svg width="100%" height="100%" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>
         <marker id="arrow-end-blue" markerWidth="4" markerHeight="4" refX="4" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="${DIM_COLOR}"/></marker>
         <marker id="arrow-start-blue" markerWidth="4" markerHeight="4" refX="0" refY="2" orient="auto"><path d="M4,0 L0,2 L4,4 z" fill="${DIM_COLOR}"/></marker>
         <pattern id="grid12" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e2e8f0" stroke-width="0.5"/><rect width="1" height="1" fill="#cbd5e1"/></pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid12)" />
      <g transform="translate(${viewportPadding}, ${(viewBoxHeight - totalContentHeight)/2})">
         ${elevationContent}
      </g>
    </svg>
  `;

  // --- SVG 2: Section ---
  const sectionScale = 5;
  const visualLetterHeight = letterHeight * sectionScale;
  const visualRacewayHeight = 6 * sectionScale;
  const visualObjectHeight = config.mount === MountType.RACEWAY ? Math.max(visualLetterHeight, visualRacewayHeight) : visualLetterHeight;
  const wallVisualHeight = visualObjectHeight * 1.5;
  const sectionViewBoxHeight = 500;
  const sectionStartY = (sectionViewBoxHeight - wallVisualHeight) / 2;
  
  let sectionContent = '';
  // Wall
  sectionContent += `<rect x="0" y="0" width="10" height="${wallVisualHeight}" fill="url(#hatch)" stroke="#333" />`;
  // Using explicit dy="0" to match BlueprintView which has no dy
  sectionContent += svgText(-5, wallVisualHeight/2, "EXISTING WALL", 10, "sans-serif", "normal", "#000", "end", "middle", undefined, -90, "none", 0, "0");
  
  // Object
  if (config.mount === MountType.RACEWAY) {
      const rwY = (wallVisualHeight - visualRacewayHeight)/2;
      const rwDepthVis = racewayDepth * sectionScale;
      sectionContent += `<g transform="translate(10, ${rwY})">`;
      sectionContent += svgRect(0, 0, rwDepthVis, visualRacewayHeight, "#e2e8f0", "#333");
      // Letter
      const letY = (visualRacewayHeight - visualLetterHeight)/2;
      const letDepthVis = letterDepth * sectionScale;
      sectionContent += `<g transform="translate(${rwDepthVis}, ${letY})">`;
      sectionContent += svgRect(0, 0, letDepthVis, visualLetterHeight, "#fff", "#000"); // Return
      sectionContent += svgRect(letDepthVis, -2, 2, visualLetterHeight+4, faceColor, "#000"); // Face
      sectionContent += `<g transform="translate(${letDepthVis}, 0)">${svgDimensionLine(0, 0, 0, visualLetterHeight, 45, `${letterHeight}"`, 1, 10)}</g>`;
      sectionContent += `</g></g>`;
  } else {
      const letY = (wallVisualHeight - visualLetterHeight)/2;
      const letDepthVis = letterDepth * sectionScale;
      const standoffVis = (config.dimensions.standoff || 0) * sectionScale;
      sectionContent += `<g transform="translate(${10 + standoffVis}, ${letY})">`;
      sectionContent += svgRect(0, 0, letDepthVis, visualLetterHeight, "#fff", "#000");
      sectionContent += svgRect(letDepthVis, -2, 2, visualLetterHeight+4, faceColor, "#000");
      sectionContent += `<g transform="translate(${letDepthVis}, 0)">${svgDimensionLine(0, 0, 0, visualLetterHeight, 45, `${letterHeight}"`, 1, 10)}</g>`;
      sectionContent += `</g>`;
  }
  // Projection Dim
  const projVal = config.mount === MountType.RACEWAY ? racewayDepth + letterDepth : letterDepth;
  const projVis = config.mount === MountType.RACEWAY ? (racewayDepth*sectionScale) + (letterDepth*sectionScale) : (letterDepth*sectionScale);
  sectionContent += `<g transform="translate(10, ${wallVisualHeight + 25})">`;
  sectionContent += svgLine(0, 0, projVis, 0, "#333", 1, "url(#arrow-start-blk)", "url(#arrow-end-blk)");
  // Using explicit dy="0" to match default baseline behavior for this label
  sectionContent += svgText(0, 20, `PROJECTION: ${projVal}"`, 10, "sans-serif", "normal", "#333", "start", "auto", undefined, 0, "none", 0, "0");
  sectionContent += `</g>`;

  const sectionSVG = `
    <svg width="100%" height="100%" viewBox="0 0 250 ${sectionViewBoxHeight}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <marker id="arrow-end-blue" markerWidth="4" markerHeight="4" refX="4" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="${DIM_COLOR}"/></marker>
         <marker id="arrow-start-blue" markerWidth="4" markerHeight="4" refX="0" refY="2" orient="auto"><path d="M4,0 L0,2 L4,4 z" fill="${DIM_COLOR}"/></marker>
         <marker id="arrow-end-blk" markerWidth="4" markerHeight="4" refX="4" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="#333"/></marker>
         <marker id="arrow-start-blk" markerWidth="4" markerHeight="4" refX="0" refY="2" orient="auto"><path d="M4,0 L0,2 L4,4 z" fill="#333"/></marker>
         <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="#ccc"/></pattern>
       </defs>
       <g transform="translate(30, ${sectionStartY})">${sectionContent}</g>
    </svg>
  `;

  // --- Assembly HTML ---
  const swatch = (label: string, col: string, sub: string) => `
    <div style="width: 80px;">
       <div style="width: 100%; height: 24px; background-color: ${col}; border: 1px solid #cbd5e1; margin-bottom: 4px;"></div>
       <div style="font-size: 9px; font-weight: bold; text-transform: uppercase;">${label}</div>
       <div style="font-size: 8px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sub}</div>
    </div>
  `;

  return `
    <div style="width: 1056px; height: 816px; background: white; border: 1px solid #cbd5e1; display: flex; flex-direction: column; font-family: sans-serif; overflow: hidden; box-sizing: border-box;">
        
        <!-- HEADER -->
        <div style="height: 80px; border-bottom: 2px solid #1e293b; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 48px; height: 48px; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; border-radius: 4px;">SF</div>
                <div>
                   <h1 style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; line-height: 1;">SignFabricator</h1>
                   <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em;">Design & Engineering Proof</span>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 24px; font-weight: bold; text-transform: uppercase; color: #1e293b;">${clientName}</div>
                <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Project Ref: #WO-${Math.floor(Math.random()*10000)}</div>
            </div>
        </div>

        <!-- CONTENT -->
        <div style="flex: 1; display: flex; overflow: hidden;">
            <div style="flex: 1; display: flex; flex-direction: column; border-right: 1px solid #e2e8f0;">
                <div style="flex: 1; position: relative; background-color: #f8fafc; overflow: hidden;">
                    <div style="position: absolute; top: 16px; left: 16px; font-weight: bold; font-size: 12px; text-transform: uppercase; color: #94a3b8; border: 1px solid #cbd5e1; padding: 4px 8px; background: white; z-index: 10;">Front Elevation</div>
                    ${elevationSVG}
                </div>
                <div style="height: 128px; padding: 24px; background: white; border-top: 1px solid #e2e8f0; display: flex; gap: 32px; flex-shrink: 0; box-sizing: border-box;">
                    <div style="flex: 1;">
                        <h3 style="font-weight: bold; font-size: 12px; text-transform: uppercase; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; margin: 0 0 8px 0;">Specifications</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: #475569;">
                            <div><span style="font-weight: bold; color: #0f172a;">Type:</span> ${config.type}</div>
                            <div><span style="font-weight: bold; color: #0f172a;">Illum:</span> ${config.illumination}</div>
                            <div><span style="font-weight: bold; color: #0f172a;">Mount:</span> ${config.mount}</div>
                            <div><span style="font-weight: bold; color: #0f172a;">LEDs:</span> ${config.ledColor}</div>
                            <div><span style="font-weight: bold; color: #0f172a;">Wall:</span> ${config.wallTexture}</div>
                            <div><span style="font-weight: bold; color: #0f172a;">Install:</span> ${config.dimensions.standoff || 0}" Standoff</div>
                        </div>
                    </div>
                    <div style="flex: 1.5;">
                        <h3 style="font-weight: bold; font-size: 12px; text-transform: uppercase; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; margin: 0 0 8px 0;">Finish Schedule</h3>
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            ${swatch("Face", faceColor, config.colors.face)}
                            ${swatch("Return", returnColor, config.colors.return)}
                            ${swatch("Trim", trimColor, config.colors.trimCap)}
                            ${config.mount === MountType.RACEWAY ? swatch("Raceway", racewayColor, config.colors.raceway) : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div style="width: 288px; background-color: #f8fafc; border-left: 1px solid #e2e8f0; display: flex; flex-direction: column; flex-shrink: 0;">
                <div style="padding: 12px; border-bottom: 1px solid #e2e8f0; background: white;">
                    <h3 style="font-weight: bold; font-size: 12px; text-transform: uppercase; color: #1e293b; margin: 0;">Section Detail</h3>
                </div>
                <div style="flex: 1; padding: 16px;">${sectionSVG}</div>
            </div>
        </div>

        <!-- FOOTER -->
        <div style="height: 56px; border-top: 2px solid #1e293b; background: #f1f5f9; display: flex; font-size: 10px; flex-shrink: 0;">
            <div style="flex: 1; border-right: 1px solid #cbd5e1; padding: 0 16px; display: flex; flex-direction: column; justify-content: center;">
                <span style="font-weight: bold; color: #64748b; text-transform: uppercase;">Approval Status</span>
                <div style="display: flex; gap: 16px; margin-top: 4px;">
                     <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; height: 12px; border: 1px solid #94a3b8; background: white;"></span> Approved</span>
                     <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; height: 12px; border: 1px solid #94a3b8; background: white;"></span> Approved as Noted</span>
                     <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; height: 12px; border: 1px solid #94a3b8; background: white;"></span> Revise</span>
                </div>
            </div>
            <div style="width: 128px; border-right: 1px solid #cbd5e1; padding: 0 16px; display: flex; flex-direction: column; justify-content: center;">
                <span style="font-weight: bold; color: #64748b; text-transform: uppercase;">Date</span>
                <span style="font-family: monospace; font-size: 12px; color: #0f172a;">${new Date().toLocaleDateString()}</span>
            </div>
            <div style="width: 256px; padding: 0 16px; display: flex; flex-direction: column; justify-content: center;">
                <span style="font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 16px;">Authorized Signature</span>
                <div style="border-bottom: 1px solid #94a3b8;"></div>
            </div>
        </div>
    </div>
  `;
};
