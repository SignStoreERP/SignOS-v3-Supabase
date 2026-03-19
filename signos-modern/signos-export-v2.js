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

    // 1. EXTRACT PURE SVG DRAWINGS (Removes dark Tailwind backgrounds and wrappers)
    const svgContainer = document.getElementById(svgContainerId);
    let svgHtml = '';
    
    if (svgContainer) {
        const svgs = svgContainer.querySelectorAll('svg');
        if (svgs.length > 0) {
            svgHtml = `<div style="display: flex; gap: 40px; justify-content: center; align-items: center; width: 100%;">`;
            svgs.forEach((svg, index) => {
                const title = index === 0 ? 'Front Elevation' : 'Side Profile';
                const clonedSvg = svg.cloneNode(true);
                // Strip UI classes and force a tight bounding height for printing
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

    const descEl = document.getElementById(jobDescId);
    const jobDesc = descEl ? descEl.value : 'No description provided.';

    // 2. EXTRACT LABOR DATA (Read directly from the new physical routing map, ignoring financial audit mode)
    let laborHtml = '';
    let totalShopMins = 0;

    if (calcResult.build.routing) {
        for (const [dept, tasks] of Object.entries(calcResult.build.routing)) {
            let deptMins = 0;
            let taskListHtml = '';
            
            tasks.forEach(t => {
                deptMins += t.time;
                totalShopMins += t.time;
                const timeStr = t.time > 0 ? `<span class="float-right font-mono text-slate-500">${t.time.toFixed(1)} mins</span>` : '';
                taskListHtml += `<li class="flex justify-between border-b border-slate-100 pb-1"><span><span class="border border-slate-300 w-3 h-3 inline-block mr-2 translate-y-0.5"></span>${t.task}</span> ${timeStr}</li>`;
            });
            
            laborHtml += `
            <div class="mb-4 avoid-break">
                <div class="border-b border-slate-800 pb-1 mb-2 flex justify-between items-end">
                    <h4 class="font-bold uppercase text-[11px]">${dept}</h4>
                    <span class="font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded">Dept Total: ${(deptMins / 60).toFixed(2)} hrs</span>
                </div>
                <ul class="text-[10px] space-y-1.5">${taskListHtml}</ul>
            </div>`;
        }
    }

    // 3. EXTRACT BILL OF MATERIALS & CUT LIST 
    let bomHtml = '';
    if (calcResult.build.bom) {
        for (const [dept, items] of Object.entries(calcResult.build.bom)) {
            bomHtml += `
            <div class="mb-3 avoid-break">
                <h4 class="font-bold uppercase text-[10px] text-slate-500 mb-1 border-b border-slate-200">${dept}</h4>
                <ul class="text-[10px] space-y-1 pl-1">`;
            items.forEach(item => {
                bomHtml += `<li class="flex items-start gap-2"><span class="font-bold text-slate-900 shrink-0">→</span> <span>${item}</span></li>`;
            });
            bomHtml += `</ul></div>`;
        }
    }

    // 4. GENERATE THE PRINT WINDOW HTML (Optimized for 1 Page)
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

            <!-- MIDDLE SECTION: SPECS & TIME -->
            <div class="grid grid-cols-4 gap-4 avoid-break">
                <div class="col-span-3 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                    <div class="bg-slate-100 px-3 py-1 border-b border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-600">Job Description & Specs</div>
                    <div class="p-3 text-[10px] font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">${jobDesc}</div>
                </div>
                <div class="col-span-1 bg-slate-900 text-white rounded-lg p-3 flex flex-col justify-center items-center shadow-md">
                    <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center mb-1">Total Est. Run Time</span>
                    <span class="text-xl font-mono font-bold text-emerald-400">${(totalShopMins / 60).toFixed(2)} Hrs</span>
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