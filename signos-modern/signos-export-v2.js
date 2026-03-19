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

SignOS_Export_v2.printWorkOrder = function(calcResult, svgContainerId, jobDescId) {
    if (!calcResult || !calcResult.build) {
        alert("No calculation data available to print. Please run the calculator first.");
        return;
    }

    const formatTime = (mins) => {
        if (!mins) return '0 mins';
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        if (h > 0 && m > 0) return `${h} hr ${m} mins`;
        if (h > 0) return `${h} hr`;
        return `${m} mins`;
    };

    // 1. EXTRACT PURE SVG DRAWINGS (Now Capturing Pan/Zoom State!)
    const svgContainer = document.getElementById(svgContainerId);
    let svgHtml = '';
    
    if (svgContainer) {
        // Target the zoom containers instead of the raw SVGs to preserve user's pan & scale
        const targets = svgContainer.querySelectorAll('.zoom-target');
        if (targets.length > 0) {
            svgHtml = `<div style="display: flex; gap: 20px; justify-content: center; align-items: stretch; width: 100%; height: 380px;">`;
            
            targets.forEach((target, index) => {
                const title = index === 0 ? 'Front Elevation' : 'Side Profile';
                const clonedTarget = target.cloneNode(true);

                // Extract the exact pan/zoom matrix the user framed on their screen
                const transformStyle = target.style.transform || 'translate(0px, 0px) scale(1)';

                // Strip the dark tailwind classes but lock the transform logic inside an overflow-hidden box
                clonedTarget.className = '';
                clonedTarget.style.cssText = `width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; transform-origin: center; transform: ${transformStyle};`;

                const innerSvg = clonedTarget.querySelector('svg');
                if (innerSvg) {
                    innerSvg.style.width = '100%';
                    innerSvg.style.height = '100%';
                    innerSvg.style.maxHeight = 'none'; // Unconstrain so it dynamically fills the new 380px height
                }

                svgHtml += `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; position: relative;">
                    <span style="position: absolute; top: 12px; left: 12px; font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; z-index: 10; background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${title}</span>
                    <div style="width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                        ${clonedTarget.outerHTML}
                    </div>
                </div>`;
            });
            svgHtml += `</div>`;
        }
    }
    if (!svgHtml) svgHtml = '<div style="text-align:center; padding:10px; font-size:12px; color:#94a3b8;">No drawing available</div>';

    // Extract Job Narrative
    const descEl = jobDescId ? document.getElementById(jobDescId) : null;
    const jobDesc = descEl ? descEl.value : 'No narrative provided.';

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
                <li class="flex justify-between border-b border-slate-100 py-1.5 items-start avoid-break">
                    <span class="flex gap-2 items-start">
                        <span class="border border-slate-400 w-2.5 h-2.5 inline-block mt-0.5 shrink-0 bg-white shadow-sm rounded-sm"></span>
                        <span class="text-[10px] leading-tight text-slate-800">${t.task}</span>
                    </span>
                    <span class="text-[9px]">${timeStr}</span>
                </li>`;
            });
            
            laborHtml += `
            <div class="mb-4 avoid-break border border-slate-200 rounded bg-white overflow-hidden">
                <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center">
                    <h4 class="font-black uppercase text-[10px] text-slate-700 tracking-widest">${dept}</h4>
                    <span class="font-bold text-[9px] text-slate-500">Total: ${formatTime(deptMins)}</span>
                </div>
                <ul class="px-3 pb-1">${taskListHtml}</ul>
            </div>`;
        }
        
        laborHtml += `
        <div class="mt-3 border-t-2 border-slate-800 flex justify-between items-center bg-slate-50 p-2.5 rounded avoid-break">
            <span class="font-black uppercase text-[10px] text-slate-700 tracking-widest">Total Estimated Labor</span>
            <span class="font-black text-emerald-600 text-sm">${formatTime(totalShopMins)}</span>
        </div>`;
    }

    // 3. EXTRACT BILL OF MATERIALS
    let bomHtml = '';
    if (calcResult.build.bom) {
        for (const [dept, items] of Object.entries(calcResult.build.bom)) {
            let deptItemsHtml = '';
            let validItemsCount = 0;

            items.forEach(item => {
                let nameStr = typeof item === 'object' ? item.name : item;
                if (!nameStr) return;
                if (nameStr.toLowerCase().includes('concrete')) return;

                if (typeof item === 'object') {
                    item.name = item.name.replace(/Lord's Adhesive/ig, 'Metal Adhesive');
                } else {
                    item = item.replace(/Lord's Adhesive/ig, 'Metal Adhesive');
                }

                validItemsCount++;

                if (typeof item === 'object') {
                    let detailsHtml = [];
                    if (item.pull && item.pull !== '--') detailsHtml.push(`<span class="font-bold text-slate-400">PULL:</span> ${item.pull}`);
                    if (item.cut && item.cut !== '--') detailsHtml.push(`<span class="font-bold text-slate-400">CUT:</span> ${item.cut}`);
                    if (item.drop && item.drop !== '--') detailsHtml.push(`<span class="font-bold text-slate-400">DROP:</span> ${item.drop}`);

                    deptItemsHtml += `
                    <div class="flex items-start gap-2 border-b border-slate-100 py-2 avoid-break">
                        <span class="border border-slate-400 w-2.5 h-2.5 inline-block mt-0.5 shrink-0 bg-white shadow-sm rounded-sm"></span>
                        <div class="flex-1">
                            <div class="font-bold text-slate-900 text-[10px] leading-tight">${item.name}</div>
                            ${detailsHtml.length > 0 ? `<div class="text-slate-600 text-[9px] leading-tight mt-1 flex flex-wrap gap-x-2 gap-y-1 bg-slate-50 p-1.5 rounded border border-slate-100">${detailsHtml.join('<span class="text-slate-300">|</span>')}</div>` : ''}
                        </div>
                    </div>`;
                } else {
                    deptItemsHtml += `
                    <div class="flex items-start gap-2 border-b border-slate-100 py-1.5 avoid-break">
                        <span class="border border-slate-400 w-2.5 h-2.5 inline-block mt-0.5 shrink-0 bg-white shadow-sm rounded-sm"></span>
                        <span class="text-[10px] leading-tight font-bold text-slate-900">${item}</span>
                    </div>`;
                }
            });

            if (validItemsCount > 0) {
                bomHtml += `
                <div class="mb-4 avoid-break border border-slate-200 rounded bg-white overflow-hidden">
                    <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                        <h4 class="font-black uppercase text-[10px] text-slate-700 tracking-widest">${dept}</h4>
                    </div>
                    <div class="px-3 pb-1">${deptItemsHtml}</div>
                </div>`;
            }
        }
    }

    // 4. GENERATE NATIVE PRODUCT SPECIFICATIONS (Stacked Layout)
    let specsHtml = '';
    if (calcResult.build.specs) {
        const s = calcResult.build.specs;
        specsHtml = `
            <div class="flex flex-col gap-2 text-[10px] text-slate-800">
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Qty:</span> <span class="font-mono text-blue-700 font-bold">${s.qty}</span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Dims:</span> <span class="font-mono text-blue-700 font-bold">${s.w}" x ${s.h}"</span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Sides:</span> <span class="font-mono font-bold">${s.sides}</span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Mount & Posts:</span> <span class="font-mono font-bold text-right">${s.mountStyle} / ${s.postSize}" ${s.postMetalName}<br/><span class="text-slate-400">(${s.thag}" AG / ${s.belowGrade}" BG)</span></span></div>
                <div class="flex justify-between border-b border-slate-100 pb-1"><span class="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Frame & Face:</span> <span class="font-mono font-bold text-right">${s.frameDepth}" ${s.isAngle ? 'Angle' : 'Tube'}<br/><span class="text-slate-400">${(s.graphicType || '').replace(/_/g, ' ')}</span></span></div>
            </div>
        `;
    }

    // 5. GENERATE THE PRINT WINDOW HTML 
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString();

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Work Order - ${dateStr}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @page { size: letter portrait; margin: 0.4in; }
            body { 
                background: white; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                font-family: ui-sans-serif, system-ui, sans-serif;
            }
            .print-container {
                max-width: 8.5in;
                margin: 0 auto;
                display: block; 
            }
            .avoid-break { page-break-inside: avoid; break-inside: avoid; }
            
            @media print {
                .print-container { width: 100%; max-width: 100%; }
            }
        </style>
    </head>
    <body class="text-slate-900">
        <div class="print-container">
            
            <!-- HEADER -->
            <div class="flex justify-between items-start border-b-2 border-slate-900 pb-2 mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-black text-sm rounded">SF</div>
                    <div>
                        <h1 class="text-base font-black uppercase tracking-tight leading-none m-0">Manufacturing Work Order</h1>
                        <span class="text-[8px] text-slate-500 uppercase tracking-widest font-bold">SignFabricator OS • Shop Floor Instructions</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-[9px] text-slate-500 uppercase font-bold mt-1 bg-slate-100 px-2 py-1 rounded border border-slate-200">Generated: ${dateStr}</div>
                </div>
            </div>

            <!-- LARGE DRAWING -->
            <div class="mb-4 avoid-break">
                <div class="bg-white border border-slate-200 rounded p-4 shadow-sm w-full">
                     ${svgHtml}
                </div>
            </div>

            <!-- NARRATIVE & SPECS (SIDE-BY-SIDE) -->
            <div class="grid grid-cols-2 gap-6 mb-6 avoid-break items-stretch">
                <!-- Job Narrative -->
                <div class="border border-slate-200 rounded bg-slate-50 overflow-hidden flex flex-col">
                    <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-700">Job Narrative</span>
                    </div>
                    <div class="p-3 bg-white text-[10px] font-mono text-slate-700 whitespace-pre-wrap leading-relaxed flex-1 h-full">
                        ${jobDesc}
                    </div>
                </div>
                
                <!-- Specs -->
                <div class="border border-slate-200 rounded bg-slate-50 overflow-hidden flex flex-col">
                    <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-700">Project Specifications</span>
                    </div>
                    <div class="p-3 bg-white flex-1 h-full">
                        ${specsHtml}
                    </div>
                </div>
            </div>

            <!-- TWO-COLUMN GRID FOR BOM & LABOR -->
            <div class="grid grid-cols-2 gap-6 items-start mt-2">
                <!-- Bill of Materials (Left) -->
                <div>
                    <h3 class="text-[11px] font-black uppercase tracking-widest text-slate-800 border-b border-slate-300 pb-1 mb-3">Pull List & Cuts</h3>
                    ${bomHtml || '<div class="text-[10px] text-slate-400 italic">No materials calculated.</div>'}
                </div>

                <!-- Fabrication Steps (Right) -->
                <div>
                    <h3 class="text-[11px] font-black uppercase tracking-widest text-slate-800 border-b border-slate-300 pb-1 mb-3">Fabrication Routing</h3>
                    ${laborHtml || '<div class="text-[10px] text-slate-400 italic">No labor tasks calculated.</div>'}
                </div>
            </div>
            
            <!-- Footer -->
            <div class="mt-6 pt-2 border-t border-slate-300 text-right text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                Internal Shop Use Only • SignFabricator OS
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