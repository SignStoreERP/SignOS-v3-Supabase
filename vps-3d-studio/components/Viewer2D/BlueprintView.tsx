
import React from 'react';
import { SignConfig, MountType, IlluminationType } from '../../types';
import { TRIM_CAP_COLORS, RETURN_COLORS, PAINT_COLORS, VINYL_SERIES, FONT_LIBRARY } from '../../constants';
import { Printer } from 'lucide-react';

// Light Blue Technical Color
const DIM_COLOR = "#3b82f6";

// Helper to look up Hex codes for swatches
const getHex = (name: string, collection: {name: string, hex: string}[]) => {
  const found = collection.find(c => c.name === name);
  return found ? found.hex : '#cccccc';
};
const getVinylHex = (series: string, name: string) => {
  const collection = VINYL_SERIES[series as keyof typeof VINYL_SERIES];
  if(!collection) return '#cccccc';
  return getHex(name, collection);
};

// Compact Color Swatch
const ColorSwatch = ({ label, color, subText }: { label: string, color: string, subText: string }) => (
  <div className="flex flex-col w-20">
    <div className="w-full h-6 border border-slate-300 shadow-sm mb-1" style={{ backgroundColor: color }}></div>
    <div className="text-[9px] font-bold text-slate-900 uppercase leading-none truncate">{label}</div>
    <div className="text-[8px] text-slate-500 leading-none truncate" title={subText}>{subText}</div>
  </div>
);

// Professional Drafting Dimension Line Component
const DimensionLine: React.FC<{
  x1: number; y1: number;
  x2: number; y2: number;
  offset: number; // Distance from object line to dimension line
  label: string;
  color?: string;
  fontSize?: number;
  scale?: number; // Scaling factor for visual consistency across different views
  textOffset?: number; // Perpendicular offset for text from the dimension line
}> = ({ 
  x1, y1, x2, y2, 
  offset, label, 
  color = DIM_COLOR, 
  fontSize = 12, 
  scale = 1,
  textOffset = 0 
}) => { 
  
  const sFontSize = fontSize * scale;
  const sStroke = 1 * scale; 
  const sGap = 5 * scale;
  const sExt = 8 * scale;
  const sTextOffset = textOffset * scale;
  
  // Determine if vertical or horizontal based on coordinates
  const isVertical = Math.abs(x1 - x2) < 0.1;
  
  // Calculate Start/End of Extension Lines
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

  // Text Placement
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

  return (
    <g>
       {/* Extension Lines */}
       <line x1={ex1_start_x} y1={ex1_start_y} x2={ex1_end_x} y2={ex1_end_y} stroke={color} strokeWidth={sStroke} />
       <line x1={ex2_start_x} y1={ex2_start_y} x2={ex2_end_x} y2={ex2_end_y} stroke={color} strokeWidth={sStroke} />

       {/* Main Dimension Line */}
       <line 
          x1={dim_x1} y1={dim_y1} x2={dim_x2} y2={dim_y2} 
          stroke={color} 
          strokeWidth={sStroke} 
          markerStart={`url(#arrow-start-blue)`} 
          markerEnd={`url(#arrow-end-blue)`} 
        />

       {/* Text background for readability */}
       <rect 
          x={tX - (label.length * sFontSize * 0.3)} 
          y={tY - (sFontSize * 0.6)} 
          width={label.length * sFontSize * 0.6} 
          height={sFontSize * 1.2} 
          fill="white" 
          opacity="0.9"
          transform={`rotate(${rotation}, ${tX}, ${tY})`}
       />

       <text 
          x={tX} 
          y={tY}
          dy="0.32em"
          transform={`rotate(${rotation}, ${tX}, ${tY})`}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={sFontSize}
          fill={color}
          fontWeight="normal"
          fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
       >
         {label}
       </text>
    </g>
  );
};

// --- Helper for Text Wrapping ---
const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    // Approx char width ~0.6em
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

export const BlueprintView: React.FC<{ config: SignConfig }> = ({ config }) => {
  
  // Robust Fallback
  const selectedFont = FONT_LIBRARY[config.fontFamily as keyof typeof FONT_LIBRARY] || Object.values(FONT_LIBRARY)[0];
  const widthFactor = selectedFont.widthFactor;
  const cssFamily = selectedFont.cssFamily || "sans-serif";
  const cssWeight = selectedFont.cssWeight || "normal";

  const letterHeight = config.dimensions.height;
  const letterDepth = config.dimensions.depth;
  const rowGap = config.dimensions.lineSpacing !== undefined ? config.dimensions.lineSpacing : (letterHeight * 0.2);
  
  // --- WIDTH CALCULATION (Text vs Raceway) ---
  let maxLineWidth = 0;
  
  config.lines.forEach((line, idx) => {
    if (!line) return;
    const textW = line.length * (letterHeight * widthFactor);
    let rowW = textW;

    // Check Raceway Length if applicable
    if (config.mount === MountType.RACEWAY) {
        // Since we are syncing 3D measurements back to config, we trust the array value
        const rwLen = config.dimensions.racewayLengths[idx] || textW;
        // If raceway is wider than text, the dimension line should span the raceway
        if (rwLen > rowW) rowW = rwLen;
    }
    if (rowW > maxLineWidth) maxLineWidth = rowW;
  });

  const drawingTotalWidth = Math.max(maxLineWidth, config.dimensions.calculatedWidth);
  const numLines = config.lines.filter(l => l).length;
  // Total Height of Sign Assembly
  const signAssemblyHeight = (numLines * letterHeight) + ((numLines - 1) * rowGap); 
  
  const racewayHeight = 6;
  const racewayDepth = 4;
  
  const viewportPadding = 48;
  const viewBoxWidth = drawingTotalWidth + (viewportPadding * 2);
  const dimScale = viewBoxWidth / 625;

  // --- DESCRIPTION TEXT GENERATION & WRAPPING ---
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
      
      // Wrap this line
      const wrapped = wrapText(desc, drawingTotalWidth, descFontSize);
      descriptionLines = [...descriptionLines, ...wrapped];
  });

  // Calculate height needed for description
  const lineHeightMult = 1.4;
  const descriptionBlockHeight = descriptionLines.length * (descFontSize * lineHeightMult) + (24 * dimScale); // + padding
  
  // Total Content Height
  const totalContentHeight = signAssemblyHeight + descriptionBlockHeight;
  
  // Adjust ViewBox Height based on Aspect Ratio or Content?
  // We want 11x8.5 ratio usually, but SVG viewBox can expand. 
  // Let's set height to fit content + padding, then the container CSS enforces aspect ratio.
  const viewBoxHeight = Math.max(totalContentHeight + (viewportPadding * 2), viewBoxWidth * 0.75); 

  // Center the Group Vertically
  const groupYOffset = (viewBoxHeight - totalContentHeight) / 2;

  // Colors
  const faceColor = getVinylHex(config.colors.vinylSeries, config.colors.face);
  const returnColor = getHex(config.colors.return, RETURN_COLORS);
  const trimColor = getHex(config.colors.trimCap, TRIM_CAP_COLORS);
  const racewayColor = standardRaceway ? standardRaceway.hex : (config.colors.raceway.startsWith('#') ? config.colors.raceway : '#333333');

  const clientName = config.lines[0] || "Client Name";
  const dateStr = new Date().toLocaleDateString();

  // New Print Handler: Prints the actual DOM element for WYSIWYG
  const handlePrint = () => {
    const container = document.querySelector('.blueprint-container');
    if (!container) return;
    
    const htmlContent = container.outerHTML;
    const printWindow = window.open('', '_blank', 'width=1150,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${clientName} - Blueprint</title>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    slate: {
                      50: '#f8fafc',
                      100: '#f1f5f9',
                      200: '#e2e8f0',
                      300: '#cbd5e1',
                      400: '#94a3b8',
                      500: '#64748b',
                      600: '#475569',
                      700: '#334155',
                      800: '#1e293b',
                      900: '#0f172a',
                      950: '#020617',
                    }
                  }
                }
              }
            }
          </script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
             body { 
               margin: 0; 
               background-color: #e2e8f0; 
               display: flex; 
               justify-content: center; 
               align-items: center; 
               min-height: 100vh; 
               font-family: 'Inter', sans-serif;
             }
             
             /* Scale for preview in window */
             .blueprint-container {
                transform: scale(0.9);
                transform-origin: center;
             }

             @media print { 
               @page { size: landscape; margin: 0; }
               body { background-color: white; display: block; }
               
               .blueprint-container {
                 margin: 0 !important;
                 transform: none !important;
                 box-shadow: none !important;
                 border: none !important;
                 width: 100% !important;
                 height: 100% !important;
                 max-width: none !important;
                 max-height: none !important;
                 overflow: hidden;
               }
               
               /* Hide scrollbars or extra UI if captured */
               ::-webkit-scrollbar { display: none; }
               
               -webkit-print-color-adjust: exact; 
               print-color-adjust: exact;
             }
          </style>
        </head>
        <body>
           ${htmlContent}
           <script>
             // Wait for Tailwind to process classes
             window.onload = () => { setTimeout(() => window.print(), 800); }
           </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Section Detail Scaling Calculations
  const sectionScale = 5;
  const visualLetterHeight = letterHeight * sectionScale;
  const visualRacewayHeight = racewayHeight * sectionScale;
  
  const visualObjectHeight = config.mount === MountType.RACEWAY 
    ? Math.max(visualLetterHeight, visualRacewayHeight) 
    : visualLetterHeight;
  const wallVisualHeight = visualObjectHeight * 1.5;
  const sectionViewBoxHeight = 500;
  const sectionStartY = (sectionViewBoxHeight - wallVisualHeight) / 2;

  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-8 bg-slate-800 overflow-auto">
      
      <div className="w-[1056px] flex justify-end mb-4 shrink-0 relative z-50 mx-auto pointer-events-none">
        <button 
            onClick={handlePrint}
            type="button"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded shadow-lg text-sm font-medium transition-colors cursor-pointer active:scale-95 pointer-events-auto"
        >
            <Printer size={16} /> Print / Save PDF
        </button>
      </div>
      
      <div className="blueprint-container w-[1056px] h-[816px] min-w-[1056px] min-h-[816px] shrink-0 mx-auto aspect-[22/17] bg-white shadow-2xl relative flex flex-col text-slate-900 font-sans border border-slate-300">
        
        {/* HEADER */}
        <div className="h-20 border-b-2 border-slate-800 flex items-center px-8 justify-between shrink-0">
          <div className="flex-1 flex items-center gap-4">
             <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center font-bold text-xl rounded">SF</div>
             <div>
               <h1 className="text-xl font-bold uppercase tracking-wide leading-none">SignFabricator</h1>
               <span className="text-xs text-slate-500 uppercase tracking-widest">Design & Engineering Proof</span>
             </div>
          </div>
          <div className="text-right">
             <div className="text-2xl font-bold uppercase text-slate-800 truncate max-w-md">{clientName}</div>
             <div className="text-xs text-slate-500 uppercase">Project Ref: #WO-{Math.floor(Math.random()*10000)}</div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex overflow-hidden">
           
           {/* LEFT: DRAWING */}
           <div className="flex-1 flex flex-col border-r border-slate-200">
              
              <div className="flex-1 relative flex items-center justify-center border-b border-slate-200 bg-slate-50 overflow-hidden">
                <span className="absolute top-4 left-4 font-bold text-xs uppercase text-slate-400 border border-slate-300 px-2 py-1 rounded z-10 bg-white">Front Elevation</span>
                
                <svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <marker id="arrow-end-blue" markerWidth="4" markerHeight="4" refX="4" refY="2" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L4,2 L0,4 z" fill={DIM_COLOR} />
                        </marker>
                        <marker id="arrow-start-blue" markerWidth="4" markerHeight="4" refX="0" refY="2" orient="auto" markerUnits="strokeWidth">
                            <path d="M4,0 L0,2 L4,4 z" fill={DIM_COLOR} />
                        </marker>
                        <marker id="arrow-end-blk" markerWidth="4" markerHeight="4" refX="4" refY="2" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L4,2 L0,4 z" fill="#333" />
                        </marker>
                        <marker id="arrow-start-blk" markerWidth="4" markerHeight="4" refX="0" refY="2" orient="auto" markerUnits="strokeWidth">
                            <path d="M4,0 L0,2 L4,4 z" fill="#333" />
                        </marker>
                        <pattern id="grid12" width="12" height="12" patternUnits="userSpaceOnUse">
                            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                            <rect width="1" height="1" fill="#cbd5e1"/>
                        </pattern>
                        <pattern id="grid1" width="1" height="1" patternUnits="userSpaceOnUse">
                            <rect width="0.1" height="0.1" fill="#f1f5f9"/>
                        </pattern>
                    </defs>

                    <rect x="0" y="0" width={viewBoxWidth} height={viewBoxHeight} fill="url(#grid1)" />
                    <rect x="0" y="0" width={viewBoxWidth} height={viewBoxHeight} fill="url(#grid12)" />

                    <g transform={`translate(${viewportPadding}, 0)`}>
                        <g transform={`translate(0, ${groupYOffset})`}>
                            
                            {/* GEOMETRY & TEXT */}
                            {config.lines.map((line, i) => {
                                if(!line) return null;
                                
                                const lineHeight = letterHeight + rowGap; 
                                const y = i * lineHeight;
                                const calculatedWidth = Math.max(0.1, line.length * (letterHeight * widthFactor));
                                
                                const x = (drawingTotalWidth - calculatedWidth) / 2;
                                
                                const rwLen = config.dimensions.racewayLengths[i] || calculatedWidth;
                                const rwX = (drawingTotalWidth - rwLen) / 2;

                                const visualFontSize = letterHeight * 1.35; 

                                return (
                                    <g key={i}>
                                        {config.mount === MountType.RACEWAY && (
                                            <rect 
                                                x={rwX} 
                                                y={y + (letterHeight/2) - (racewayHeight/2) + (config.dimensions.racewayOffset || 0)} 
                                                width={rwLen} 
                                                height={racewayHeight} 
                                                fill={racewayColor} 
                                                stroke="#94a3b8" 
                                                strokeWidth="0.5"
                                            />
                                        )}
                                        <text 
                                            x={x + (calculatedWidth/2)} 
                                            y={y + (letterHeight/2)}
                                            dy="0.1em"
                                            textAnchor="middle" 
                                            dominantBaseline="middle"
                                            fontSize={visualFontSize} 
                                            fontFamily={cssFamily}
                                            fontWeight={cssWeight}
                                            fill={faceColor}
                                            stroke={trimColor}
                                            strokeWidth={config.illumination === IlluminationType.HALO_LIT ? 0 : (letterHeight * 0.02)}
                                            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                                        >
                                            {line}
                                        </text>
                                    </g>
                                )
                            })}

                            {/* Overall Width Dimension */}
                            <DimensionLine 
                                x1={0} y1={0} 
                                x2={drawingTotalWidth} y2={0} 
                                offset={-24 * dimScale} 
                                label={`${Math.round(drawingTotalWidth)}" (${Math.floor(drawingTotalWidth/12)}'-${Math.round(drawingTotalWidth%12)}")`} 
                                scale={dimScale}
                                textOffset={20}
                            />

                            {/* Overall Height Dimension */}
                            <DimensionLine 
                                x1={0} y1={0} 
                                x2={0} y2={signAssemblyHeight} 
                                offset={-24 * dimScale}
                                label={`${Math.round(signAssemblyHeight)}" (${Math.floor(signAssemblyHeight/12)}'-${Math.round(signAssemblyHeight%12)}")`} 
                                scale={dimScale}
                                textOffset={20}
                            />
                            
                            {/* DESCRIPTION BLOCK */}
                            <g transform={`translate(${drawingTotalWidth/2}, ${signAssemblyHeight + (48 * dimScale)})`}>
                              {descriptionLines.map((textLine, idx) => (
                                <text 
                                  key={idx}
                                  x="0" 
                                  y={idx * (descFontSize * 1.4)} 
                                  textAnchor="middle" 
                                  fontSize={descFontSize} 
                                  fontFamily="monospace" 
                                  fill="#334155"
                                >
                                   {textLine}
                                </text>
                              ))}
                            </g>

                        </g>
                    </g>
                </svg>
              </div>

              {/* FOOTER SPECS */}
              <div className="h-32 p-6 bg-white shrink-0 flex gap-8 border-t border-slate-200">
                  <div className="flex-1 space-y-1">
                      <h3 className="font-bold text-xs uppercase text-slate-800 border-b border-slate-100 pb-1 mb-2">Specifications</h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-600">
                          <div><span className="font-bold text-slate-900">Type:</span> {config.type}</div>
                          <div><span className="font-bold text-slate-900">Illum:</span> {config.illumination}</div>
                          <div><span className="font-bold text-slate-900">Mount:</span> {config.mount}</div>
                          <div><span className="font-bold text-slate-900">LEDs:</span> {config.ledColor}</div>
                          <div><span className="font-bold text-slate-900">Wall:</span> {config.wallTexture}</div>
                          <div><span className="font-bold text-slate-900">Install:</span> {config.dimensions.standoff || 0}" Standoff</div>
                      </div>
                  </div>
                  
                  <div className="flex-[1.5]">
                      <h3 className="font-bold text-xs uppercase text-slate-800 border-b border-slate-100 pb-1 mb-2">Finish Schedule</h3>
                      <div className="flex flex-wrap gap-3 content-start">
                          <ColorSwatch label="Face" color={faceColor} subText={`${config.colors.face}`} />
                          <ColorSwatch label="Return" color={returnColor} subText={config.colors.return} />
                          <ColorSwatch label="Trim" color={trimColor} subText={config.colors.trimCap} />
                          {config.mount === MountType.RACEWAY && (
                              <ColorSwatch label="Raceway" color={racewayColor} subText={config.colors.raceway} />
                          )}
                      </div>
                  </div>
              </div>

           </div>

           {/* RIGHT: SECTION VIEW */}
           <div className="w-72 bg-slate-50 flex flex-col border-l border-slate-200 shrink-0">
              <div className="p-3 border-b border-slate-200 bg-white">
                  <h3 className="font-bold text-xs uppercase text-slate-800">Section Detail</h3>
              </div>
              <div className="flex-1 p-4 relative">
                  <svg width="100%" height="100%" viewBox={`0 0 250 ${sectionViewBoxHeight}`}>
                      <g transform={`translate(30, ${sectionStartY})`}>
                          {/* 1. Wall (Dynamic Height: 1.5x of sign height) */}
                          <rect x="0" y="0" width="10" height={wallVisualHeight} fill="url(#hatch)" stroke="#333" />
                          <text x="-5" y={wallVisualHeight / 2} textAnchor="end" dominantBaseline="middle" fontSize="10" fontFamily="sans-serif" transform={`rotate(-90, -5, ${wallVisualHeight / 2})`}>EXISTING WALL</text>

                          <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                              <rect width="2" height="4" transform="translate(0,0)" fill="#ccc"></rect>
                          </pattern>

                          {/* 2. Raceway & Letters (Scaled x5) */}
                          {config.mount === MountType.RACEWAY ? (
                              <g transform={`translate(10, ${(wallVisualHeight - visualRacewayHeight)/2})`}>
                                  {/* Raceway Body (6x4 -> 30x20) */}
                                  <rect x="0" y="0" width={racewayDepth * sectionScale} height={visualRacewayHeight} fill="#e2e8f0" stroke="#333" />
                                  <line x1="0" y1="0" x2={racewayDepth * sectionScale} y2={visualRacewayHeight} stroke="#ccc" />
                                  
                                  {/* Letter attached to raceway (Height * 5) */}
                                  <g transform={`translate(${racewayDepth * sectionScale}, ${(visualRacewayHeight - visualLetterHeight)/2})`}>
                                      {/* Return */}
                                      <rect x="0" y="0" width={letterDepth * sectionScale} height={visualLetterHeight} fill="#fff" stroke="#000" />
                                      {/* Face */}
                                      <rect x={letterDepth * sectionScale} y="-2" width="2" height={visualLetterHeight + 4} fill={faceColor} stroke="#000" />

                                      {/* Dimension: Letter Height */}
                                      <g transform={`translate(${(letterDepth * sectionScale)}, 0)`}>
                                        <DimensionLine 
                                          x1={0} y1={0} 
                                          x2={0} y2={visualLetterHeight} 
                                          offset={45} 
                                          label={`${letterHeight}"`} 
                                          color={DIM_COLOR}
                                          textOffset={10}
                                        />
                                      </g>
                                  </g>
                              </g>
                          ) : (
                              // Direct Mount
                              <g transform={`translate(${config.dimensions.standoff ? (config.dimensions.standoff * sectionScale) + 10 : 10}, ${(wallVisualHeight - visualLetterHeight)/2})`}>
                                  <rect x="0" y="0" width={letterDepth * sectionScale} height={visualLetterHeight} fill="#fff" stroke="#000" />
                                  <rect x={letterDepth * sectionScale} y="-2" width="2" height={visualLetterHeight + 4} fill={faceColor} stroke="#000" />
                                  
                                  {/* Dimension: Letter Height */}
                                  <g transform={`translate(${(letterDepth * sectionScale)}, 0)`}>
                                    <DimensionLine 
                                      x1={0} y1={0} 
                                      x2={0} y2={visualLetterHeight} 
                                      offset={45} 
                                      label={`${letterHeight}"`} 
                                      color={DIM_COLOR}
                                      textOffset={10}
                                    />
                                  </g>
                              </g>
                          )}

                          {/* Dimension: Projection */}
                          <g transform={`translate(10, ${wallVisualHeight + 25})`}>
                              <line x1="0" y1="0" x2={config.mount === MountType.RACEWAY ? (racewayDepth*sectionScale) + (letterDepth * sectionScale) : (letterDepth * sectionScale)} y2="0" stroke="#333" markerStart="url(#arrow-start-blk)" markerEnd="url(#arrow-end-blk)" />
                              <text x="0" y="20" fontSize="10" fill="#333" fontFamily="sans-serif">PROJECTION: {config.mount === MountType.RACEWAY ? racewayDepth + config.dimensions.depth : config.dimensions.depth}"</text>
                          </g>

                      </g>
                  </svg>
              </div>
           </div>
        </div>

        {/* FOOTER SIGN-OFF */}
        <div className="h-14 border-t-2 border-slate-800 flex divide-x divide-slate-300 bg-slate-100 text-[10px] shrink-0">
            <div className="flex-1 p-2 flex flex-col justify-center px-4">
                <span className="font-bold text-slate-500 uppercase mb-1">Approval Status</span>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-slate-400 bg-white"></div> Approved</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-slate-400 bg-white"></div> Approved as Noted</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 border border-slate-400 bg-white"></div> Revise</div>
                </div>
            </div>
            <div className="w-32 p-2 flex flex-col justify-center px-4">
                <span className="font-bold text-slate-500 uppercase">Date</span>
                <span className="font-mono text-slate-900 text-xs">{dateStr}</span>
            </div>
            <div className="w-64 p-2 flex flex-col justify-center px-4">
                 <span className="font-bold text-slate-500 uppercase">Authorized Signature</span>
                 <div className="border-b border-slate-400 h-6 w-full"></div>
            </div>
        </div>

      </div>
    </div>
  );
}
