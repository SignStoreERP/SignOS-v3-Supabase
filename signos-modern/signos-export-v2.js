window.SignOS_Export_v2 = window.SignOS_Export_v2 || {};

// signos-export-v2.js (v3.1 CorelDraw Pipeline)
function downloadProductionSVG() {
    const svgEl = document.getElementById('live-production-preview');
    if (!svgEl) return alert("Build a sign first!");

    // Extract the raw physical dimensions we hid in data-attributes
    const w = parseFloat(svgEl.getAttribute('data-width-in'));
    const h = parseFloat(svgEl.getAttribute('data-height-in'));

    // Extract the exact inner contents (the rect and the scaled text paths)
    const innerContent = svgEl.innerHTML;

    // Build a perfectly clean, CorelDraw-friendly SVG wrapper
    const cleanSVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${w}in" height="${h}in" viewBox="0 0 ${w * 72} ${h * 72}" xmlns="http://www.w3.org/2000/svg">
    ${innerContent}
</svg>`;

    const blob = new Blob([cleanSVG], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignOS_PROD_Nameplate_${w}x${h}.svg`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function downloadBulkProductionSVG() {
    // currentManifests is populated by the Bulk Calculator
    if (!currentManifests || currentManifests.length === 0) return alert("Build a batch first!");

    const DPI = 72; 
    const sheetW = 48; // 48 inches wide
    const sheetH = 24; // 24 inches tall
    const gap = 0.25;  // 1/4 inch gap between signs
    const margin = 0.25; // 1/4 inch border margin

    let svgContent = '';
    let currentX = margin;
    let currentY = margin;
    let totalSigns = 0;

    currentManifests.forEach((item, index) => {
        if(!item.manifest) return;
        const man = item.manifest;

        for(let q = 0; q < item.qty; q++) {
            // If the next sign pushes past the 48" width, carriage return to the next row!
            if (currentX + man.width > sheetW - margin) {
                currentX = margin;
                currentY += man.height + gap;
            }

            // Build this specific sign's group and translate it to the current X/Y coordinate
            let signGroup = `
            <!-- Sign #${index+1} | Copy ${q+1} -->
            <g id="${man.substrateLayerName}_S${index+1}_Q${q+1}" transform="translate(${currentX * DPI}, ${currentY * DPI})">
                <rect width="${man.width * DPI}" height="${man.height * DPI}" fill="${man.substrateColor}" stroke="#000000" stroke-width="0.5"/>
                <g transform="scale(${DPI})">
                    ${man.objects.map(obj => `
                        <path id="${obj.name}" d="${obj.d}" fill="${man.textColor}" transform="translate(${obj.x}, ${obj.y})" />
                    `).join('')}
                </g>
            </g>`;

            svgContent += signGroup;

            // Move the X coordinate over for the next sign
            currentX += man.width + gap;
            totalSigns++;
        }
    });

    // Alert the user if the layout spills off the bottom of the 24" sheet
    if (currentY + currentManifests.manifest.height > sheetH - margin) {
        alert("Note: This batch requires more than one 48x24 sheet. The overflowing signs will be located below the artboard boundary in CorelDraw.");
    }

    // Wrap the entire nested layout in a strict 48x24 production artboard
    const cleanSVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${sheetW}in" height="${sheetH}in" viewBox="0 0 ${sheetW * DPI} ${sheetH * DPI}" xmlns="http://www.w3.org/2000/svg">
    <!-- 48x24 Sheet Boundary Reference -->
    <rect width="${sheetW * DPI}" height="${sheetH * DPI}" fill="none" stroke="red" stroke-width="2"/>
    ${svgContent}
</svg>`;

    const blob = new Blob([cleanSVG], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignOS_BULK_CutSheet_48x24_${totalSigns}qty.svg`;
    a.click();
    URL.revokeObjectURL(url);
}

// Append to the bottom of signos-export-v2.js
SignOS_Export_v2.exportADA = function(manifest) {
    if (!manifest || !manifest.svgContent) return alert("Manifest not ready!");

    let finalSVG = `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${manifest.w}in" height="${manifest.h}in" viewBox="0 0 ${manifest.w} ${manifest.h}">
        <!-- Substrate Boundary -->
        <rect width="${manifest.w}" height="${manifest.h}" fill="${manifest.coreHex}" rx="${manifest.radius}" ry="${manifest.radius}" />
        <!-- Vector Tactile & Braille Paths -->
        <g fill="${manifest.tactileHex}">
            ${manifest.svgContent.replace(/currentColor/g, manifest.tactileHex)}
        </g>
    </svg>`;

    const blob = new Blob([finalSVG], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignOS_PROD_ADA_${manifest.w}x${manifest.h}.svg`;
    a.click();
    URL.revokeObjectURL(url);
};

// --- MANUFACTURING WORK ORDER GENERATOR ---
window.SignOS_Export_v2 = window.SignOS_Export_v2 || {};

SignOS_Export_v2.printWorkOrder = function(calcResult, svgContainerId) {
    if (!calcResult || !calcResult.build) {
        alert("No calculation data available to print. Please run the calculator first.");
        return;
    }

    // Helper: Format decimal minutes into readable Hours and Minutes
    const formatTime = (mins) => {
        if (!mins) return '0 mins';
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        if (h > 0 && m > 0) return `${h} hr ${m} mins`;
        if (h > 0) return `${h} hr`;
        return `${m} mins`;
    };

    // 1. EXTRACT PURE SVG DRAWINGS
    const svgContainer = document.getElementById(svgContainerId);
    let svgHtml = '';
    
    if (svgContainer) {
        const svgs = svgContainer.querySelectorAll('svg');
        if (svgs.length > 0) {
            svgHtml = `<div style="display: flex; gap: 40px; justify-content: center; align-items: center; width: 100%;">`;
            svgs.forEach((svg, index) => {
                const title = index === 0 ? 'Front Elevation' : 'Side Profile';
                const clonedSvg = svg.cloneNode(true);
                clonedSvg.removeAttribute('class');
                clonedSvg.style.maxHeight = '280px';
                clonedSvg.style.width = 'auto';
                
                svgHtml += `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <span style="font-size: 10px; font-weight: bold; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">${title}</span>
                    ${clonedSvg.outerHTML}
                </div>`;
            });
            svgHtml += `</div>`;
        }
    }
    if (!svgHtml) svgHtml = '<div style="text-align:center; padding:20px; color:#94a3b8;">No drawing available</div>';

    // 2. EXTRACT LABOR DATA (With Checkboxes & Time Formatting)
    let laborHtml = '';
    let totalShopMins = 0;

    if (calcResult.build.routing) {
        for (const [dept, tasks] of Object.entries(calcResult.build.routing)) {
            let deptMins = 0;
            let taskListHtml = '';
            
            tasks.forEach(t => {
                deptMins += t.time;
                totalShopMins += t.time;
                const timeStr = t.time > 0 ? `<span class="float-right font-mono text-slate-500">${formatTime(t.time)}</span>` : '';
                taskListHtml += `
                <li class="flex justify-between border-b border-slate-100 pb-1.5 pt-1 items-start">
                    <span class="flex gap-2 items-start">
                        <span class="border border-slate-300 w-3 h-3 inline-block mt-0.5 shrink-0 bg-white shadow-sm"></span>
                        <span>${t.task}</span>
                    </span>
                    ${timeStr}
                </li>`;
            });
            
            laborHtml += `
            <div class="mb-4 avoid-break">
                <div class="border-b border-slate-800 pb-1 mb-2 flex justify-between items-end">
                    <h4 class="font-bold uppercase text-[11px]">${dept}</h4>
                    <span class="font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded">Dept Total: ${formatTime(deptMins)}</span>
                </div>
                <ul class="text-[10px] space-y-1">${taskListHtml}</ul>
            </div>`;
        }
        
        // Add Total Labor Time at the bottom of the Fabrication Steps
        laborHtml += `
        <div class="mt-4 pt-3 border-t-2 border-slate-800 flex justify-between items-center bg-slate-50 p-3 rounded-lg shadow-inner">
            <span class="font-black uppercase text-[11px] text-slate-700 tracking-widest">Total Labor Time</span>
            <span class="font-black text-emerald-600 text-base">${formatTime(totalShopMins)}</span>
        </div>`;
    }

    // 3. EXTRACT BILL OF MATERIALS & CUT LIST (With Sub-Columns)
    let bomHtml = '';
    if (calcResult.build.bom) {
        for (const [dept, items] of Object.entries(calcResult.build.bom)) {
            bomHtml += `
            <div class="mb-4 avoid-break">
                <h4 class="font-bold uppercase text-[11px] text-slate-800 mb-2 border-b border-slate-300 pb-1">${dept}</h4>
                <div class="text-[10px] space-y-2 pl-1">`;
            
            items.forEach(item => {
                if (typeof item === 'object') {
                    // Pull / Cut / Drop Structured Layout
                    bomHtml += `
                    <div class="flex items-start gap-2 border-b border-slate-100 pb-2">
                        <span class="border border-slate-300 w-3 h-3 inline-block mt-0.5 shrink-0 bg-white shadow-sm"></span>
                        <div class="flex-1">
                            <div class="font-bold text-slate-900 text-[11px] mb-1.5">${item.name}</div>
                            <div class="grid grid-cols-3 gap-2 text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                                <div><span class="text-slate-400 font-bold uppercase text-[8px] tracking-widest block mb-0.5">Pull</span> <span class="font-mono text-[9px]">${item.pull}</span></div>
                                <div><span class="text-slate-400 font-bold uppercase text-[8px] tracking-widest block mb-0.5">Cut</span> <span class="font-mono text-[9px]">${item.cut}</span></div>
                                <div><span class="text-slate-400 font-bold uppercase text-[8px] tracking-widest block mb-0.5">Drop</span> <span class="font-mono text-[9px]">${item.drop}</span></div>
                            </div>
                        </div>
                    </div>`;
                } else {
                    // Legacy Fallback for other Edge Functions that haven't been updated yet
                    bomHtml += `
                    <div class="flex items-start gap-2 border-b border-slate-100 pb-1.5">
                        <span class="border border-slate-300 w-3 h-3 inline-block mt-0.5 shrink-0 bg-white shadow-sm"></span>
                        <span>${item}</span>
                    </div>`;
                }
            });
            bomHtml += `</div></div>`;
        }
    }

    // 4. GENERATE NATIVE PRODUCT SPECIFICATIONS
    let specsHtml = '';
    if (calcResult.build.specs) {
        const s = calcResult.build.specs;
        specsHtml = `
            <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-[10px] text-slate-700">
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Quantity</span> <span class="font-mono text-blue-700 font-bold">${s.qty} Unit(s)</span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Dimensions</span> <span class="font-mono text-blue-700 font-bold">${s.w}" W x ${s.h}" H</span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Sides</span> <span class="font-mono font-bold">${s.sides}-Sided</span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Mount Style</span> <span class="font-mono font-bold">${s.mountStyle}</span></div>
                <div class="col-span-2 flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Structural Posts</span> <span class="font-mono font-bold">${s.postSize}" ${s.postMetalName} (${s.thag}" Above Grade / ${s.belowGrade}" Below Grade)</span></div>
                <div class="col-span-2 flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Internal Frame</span> <span class="font-mono font-bold">${s.frameDepth}" Depth ${s.isAngle ? '(Angle Iron)' : '(Square Tube)'}</span></div>
                <div class="col-span-2 flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Graphic Finish</span> <span class="font-mono font-bold">${(s.graphicType || '').replace(/_/g, ' ')}</span></div>
            </div>
        `;
    } else {
        specsHtml = '<div class="text-[10px] text-slate-400 italic">No specifications provided in calculation payload.</div>';
    }

    // 5. GENERATE THE PRINT WINDOW HTML
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString();
    const orderNum = Math.floor(Math.random() * 90000) + 10000;

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Work Order - ${dateStr}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @page { size: 8.5in 11in; margin: 0.3in; }
            body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .avoid-break { page-break-inside: avoid; }
        </style>
    </head>
    <body class="font-sans text-slate-900 p-6 max-w-4xl mx-auto border border-slate-200 min-h-screen flex flex-col relative">
        
        <!-- HEADER -->
        <div class="flex justify-between items-start border-b-4 border-slate-900 pb-3 mb-4 shrink-0">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-slate-900 text-white flex items-center justify-center font-black text-lg rounded">SF</div>
                <div>
                    <h1 class="text-xl font-black uppercase tracking-tight leading-none m-0">Manufacturing Work Order</h1>
                    <span class="text-[9px] text-slate-500 uppercase tracking-widest font-bold">SignFabricator OS • Shop Floor Instructions</span>
                </div>
            </div>
            <div class="text-right">
                <div class="text-lg font-black font-mono">#WO-${orderNum}</div>
                <div class="text-[10px] text-slate-500 uppercase font-bold mt-1">Generated: ${dateStr}</div>
            </div>
        </div>

        <div class="flex flex-col gap-4 flex-1">
            
            <!-- TOP SECTION: COMPACT DRAWING -->
            <div class="bg-white border border-slate-200 rounded-lg p-4 avoid-break flex flex-col items-center">
                 ${svgHtml}
            </div>

            <!-- MIDDLE SECTION: SPECS -->
            <div class="border border-slate-200 rounded-lg overflow-hidden flex flex-col avoid-break">
                <div class="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-700">Project Specifications</span>
                </div>
                <div class="p-4 bg-white">
                    ${specsHtml}
                </div>
            </div>

            <!-- BOTTOM SECTION: BOM & LABOR -->
            <div class="grid grid-cols-2 gap-6 flex-1 mt-2">
                
                <!-- Bill of Materials -->
                <div class="flex flex-col h-full">
                    <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center shrink-0 border border-b-0 rounded-t-lg">
                        <span class="text-[9px] font-black uppercase tracking-widest text-slate-700">Pull List & Cuts</span>
                    </div>
                    <div class="p-4 flex-1 border border-slate-200 rounded-b-lg">
                        ${bomHtml || '<div class="text-[10px] text-slate-400 italic">No materials calculated.</div>'}
                    </div>
                </div>

                <!-- Labor Execution -->
                <div class="flex flex-col h-full">
                    <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center shrink-0 border border-b-0 rounded-t-lg">
                        <span class="text-[9px] font-black uppercase tracking-widest text-slate-700">Fabrication Steps</span>
                    </div>
                    <div class="p-4 flex-1 border border-slate-200 rounded-b-lg">
                        ${laborHtml || '<div class="text-[10px] text-slate-400 italic">No labor tasks calculated.</div>'}
                    </div>
                </div>

            </div>
        </div>

        <!-- FOOTER SIGNOFF -->
        <div class="mt-4 pt-3 border-t-2 border-slate-800 grid grid-cols-3 gap-4 shrink-0 text-[8px] font-bold uppercase text-slate-500">
            <div>
                <div class="mb-3">Fabricator Signature:</div>
                <div class="border-b border-slate-400 w-40"></div>
            </div>
            <div>
                <div class="mb-3">QA / Final Inspection:</div>
                <div class="border-b border-slate-400 w-40"></div>
            </div>
            <div class="text-right flex flex-col justify-end">
                Page 1 of 1 • Internal Shop Use Only
            </div>
        </div>
        
        <script>
            window.onload = () => { setTimeout(() => window.print(), 500); }
        </script>
    </body>
    </html>
    `);
    
    printWindow.document.close();
};