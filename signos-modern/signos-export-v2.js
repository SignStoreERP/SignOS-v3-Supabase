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
                // Constrain height strictly so it doesn't blow out the first page
                clonedSvg.style.maxHeight = '220px';
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

    // 2. EXTRACT LABOR DATA
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
                <li class="flex justify-between border-b border-slate-100 pb-1.5 pt-1.5 items-start avoid-break">
                    <span class="flex gap-2 items-start">
                        <span class="border border-slate-300 w-3 h-3 inline-block mt-0.5 shrink-0 bg-white shadow-sm"></span>
                        <span>${t.task}</span>
                    </span>
                    ${timeStr}
                </li>`;
            });
            
            laborHtml += `
            <div class="mb-5 avoid-break border border-slate-200 rounded-lg bg-white overflow-hidden">
                <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center">
                    <h4 class="font-black uppercase text-[10px] text-slate-700 tracking-widest">${dept}</h4>
                    <span class="font-bold text-[9px] text-slate-500">Dept Total: ${formatTime(deptMins)}</span>
                </div>
                <ul class="text-[10px] px-3 pb-1">${taskListHtml}</ul>
            </div>`;
        }
        
        laborHtml += `
        <div class="mt-4 pt-3 border-t-2 border-slate-800 flex justify-between items-center bg-slate-50 p-3 rounded-lg avoid-break">
            <span class="font-black uppercase text-[11px] text-slate-700 tracking-widest">Total Estimated Labor</span>
            <span class="font-black text-emerald-600 text-sm">${formatTime(totalShopMins)}</span>
        </div>`;
    }

    // 3. EXTRACT BILL OF MATERIALS & CUT LIST 
    let bomHtml = '';
    if (calcResult.build.bom) {
        for (const [dept, items] of Object.entries(calcResult.build.bom)) {
            let deptItemsHtml = '';
            items.forEach(item => {
                if (typeof item === 'object') {
                    deptItemsHtml += `
                    <div class="flex items-start gap-2 border-b border-slate-100 py-2 avoid-break">
                        <span class="border border-slate-300 w-3 h-3 inline-block mt-0.5 shrink-0 bg-white shadow-sm"></span>
                        <div class="flex-1">
                            <div class="font-bold text-slate-900 text-[11px] mb-1.5">${item.name}</div>
                            <div class="grid grid-cols-3 gap-3 text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                                <div><span class="text-slate-400 font-bold uppercase text-[8px] tracking-widest block mb-0.5">Pull</span> <span class="font-mono text-[9px]">${item.pull}</span></div>
                                <div><span class="text-slate-400 font-bold uppercase text-[8px] tracking-widest block mb-0.5">Cut</span> <span class="font-mono text-[9px]">${item.cut}</span></div>
                                <div><span class="text-slate-400 font-bold uppercase text-[8px] tracking-widest block mb-0.5">Drop / Remnant</span> <span class="font-mono text-[9px]">${item.drop}</span></div>
                            </div>
                        </div>
                    </div>`;
                } else {
                    deptItemsHtml += `
                    <div class="flex items-start gap-2 border-b border-slate-100 py-1.5 avoid-break">
                        <span class="border border-slate-300 w-3 h-3 inline-block mt-0.5 shrink-0 bg-white shadow-sm"></span>
                        <span class="text-[10px]">${item}</span>
                    </div>`;
                }
            });

            bomHtml += `
            <div class="mb-5 avoid-break border border-slate-200 rounded-lg bg-white overflow-hidden">
                <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                    <h4 class="font-black uppercase text-[10px] text-slate-700 tracking-widest">${dept}</h4>
                </div>
                <div class="px-3 pb-1">${deptItemsHtml}</div>
            </div>`;
        }
    }

    // 4. GENERATE NATIVE PRODUCT SPECIFICATIONS
    let specsHtml = '';
    if (calcResult.build.specs) {
        const s = calcResult.build.specs;
        specsHtml = `
            <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-[10px] text-slate-700">
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Quantity</span> <span class="font-mono text-blue-700 font-bold">${s.qty} Unit(s)</span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Dimensions</span> <span class="font-mono text-blue-700 font-bold">${s.w}" W x ${s.h}" H</span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Sides</span> <span class="font-mono font-bold">${s.sides}-Sided</span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Mount Style</span> <span class="font-mono font-bold">${s.mountStyle}</span></div>
                <div class="col-span-2 flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Structural Posts</span> <span class="font-mono font-bold">${s.postSize}" ${s.postMetalName} (${s.thag}" Above Grade / ${s.belowGrade}" Below Grade)</span></div>
                <div class="col-span-2 flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Internal Frame</span> <span class="font-mono font-bold">${s.frameDepth}" Depth ${s.isAngle ? '(Angle Iron)' : '(Square Tube)'}</span></div>
                <div class="col-span-2 flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-900 uppercase tracking-widest text-[9px]">Graphic Finish</span> <span class="font-mono font-bold">${(s.graphicType || '').replace(/_/g, ' ')}</span></div>
            </div>
        `;
    }

    // 5. GENERATE THE PRINT WINDOW HTML (NATIVE PAGINATION)
    const printWindow = window.open('', '_blank');
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
            /* STRICT PAGE CONSTRAINTS FOR 8.5x11 PORTRAIT */
            @page { size: letter portrait; margin: 0.5in; }
            body { 
                background: #f1f5f9; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                font-family: ui-sans-serif, system-ui, sans-serif;
            }
            .page-wrapper {
                max-width: 8.5in;
                margin: 20px auto;
                background: white;
                padding: 0.5in;
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
            }
            /* Ensure blocks don't get sliced in half by the printer */
            .avoid-break { page-break-inside: avoid; break-inside: avoid; }
            .page-break-before { page-break-before: always; break-before: page; }
            
            /* Remove shadows and margins when physically printing */
            @media print {
                body { background: white; margin: 0; padding: 0; }
                .page-wrapper { max-width: 100%; margin: 0; padding: 0; box-shadow: none; }
            }
        </style>
    </head>
    <body>
        <div class="page-wrapper">
            
            <!-- HEADER -->
            <div class="flex justify-between items-start border-b-4 border-slate-900 pb-3 mb-6 avoid-break">
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

            <!-- DRAWING & SPECS (Always kept together on Page 1) -->
            <div class="avoid-break mb-8">
                <div class="bg-white border border-slate-200 rounded-lg p-4 mb-4">
                     ${svgHtml}
                </div>

                <div class="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                    <div class="bg-slate-100 px-4 py-2 border-b border-slate-200">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-700">Project Specifications</span>
                    </div>
                    <div class="p-4 bg-white">
                        ${specsHtml}
                    </div>
                </div>
            </div>

            <!-- BILL OF MATERIALS (Flows naturally to Page 2 if needed) -->
            <div class="mb-8">
                <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 border-b-2 border-slate-300 pb-1 mb-4">Pull List & Cuts</h3>
                ${bomHtml || '<div class="text-[10px] text-slate-400 italic">No materials calculated.</div>'}
            </div>

            <!-- FABRICATION STEPS (Flows naturally downward) -->
            <div class="mb-8">
                <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 border-b-2 border-slate-300 pb-1 mb-4">Fabrication Routing</h3>
                ${laborHtml || '<div class="text-[10px] text-slate-400 italic">No labor tasks calculated.</div>'}
            </div>

            <!-- FOOTER SIGNOFF -->
            <div class="mt-8 pt-4 border-t-2 border-slate-800 grid grid-cols-3 gap-4 text-[8px] font-bold uppercase text-slate-500 avoid-break">
                <div>
                    <div class="mb-4">Fabricator Signature:</div>
                    <div class="border-b border-slate-400 w-48"></div>
                </div>
                <div>
                    <div class="mb-4">QA / Final Inspection:</div>
                    <div class="border-b border-slate-400 w-48"></div>
                </div>
                <div class="text-right flex flex-col justify-end">
                    Internal Shop Use Only • SignFabricator OS
                </div>
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