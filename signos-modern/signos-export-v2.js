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
SignOS_Export_v2.printWorkOrder = function(calcResult, svgContainerId, jobDescId) {
    if (!calcResult || !calcResult.cost) {
        alert("No calculation data available to print. Please run the calculator first.");
        return;
    }

    // 1. GRAB THE PHYSICAL DOM ELEMENTS (SVG & Description)
    const svgEl = document.getElementById(svgContainerId);
    // Remove background colors from the drafting viewport so it prints cleanly on white paper
    let svgHtml = svgEl ? svgEl.innerHTML.replace(/background-color: [^;]+;/g, 'background-color: white;') : '<div style="text-align:center; padding:20px; color:#94a3b8;">No drawing available</div>';
    
    const descEl = document.getElementById(jobDescId);
    const jobDesc = descEl ? descEl.value : 'No description provided.';

    // 2. EXTRACT & SANITIZE LABOR DATA (Strictly Time, No Dollars)
    const DEPT_TITLES = {
        'METAL_LAB': 'Metal Fabrication',
        'PAINT_LAB': 'Paint & Finishes',
        'VINYL_LAB': 'Vinyl & Graphics',
        'CNC_LAB': 'CNC Routing',
        'INSTALL_LAB': 'Installation'
    };

    const laborGroups = {};
    let totalShopMins = 0;

    calcResult.cost.breakdown.forEach(item => {
        const cat = item.category || 'UNCATEGORIZED';
        
        // We only care about Labor categories for the shop floor steps
        if (cat.includes('_LAB')) {
            if (!laborGroups[cat]) laborGroups[cat] = { title: DEPT_TITLES[cat] || cat, items: [], totalMins: 0 };
            
            // Extract the pure physics time (ignoring all $ rates)
            let time = (item.meta && item.meta.time) ? item.meta.time : 0;
            
            // Clean the label (e.g., removing any accidental pricing in the name)
            let cleanLabel = item.label.replace(/\$[0-9,.]+/g, '');

            laborGroups[cat].items.push({ label: cleanLabel, time: time });
            laborGroups[cat].totalMins += time;
            totalShopMins += time;
        }
    });

    // Generate Labor HTML
    let laborHtml = '';
    for (const [cat, group] of Object.entries(laborGroups)) {
        if (group.items.length === 0) continue;
        laborHtml += `
        <div class="mb-4 avoid-break">
            <div class="border-b border-slate-800 pb-1 mb-2 flex justify-between items-end">
                <h4 class="font-bold uppercase text-[11px]">${group.title}</h4>
                <span class="font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded">Dept Total: ${(group.totalMins / 60).toFixed(2)} hrs</span>
            </div>
            <ul class="text-[10px] space-y-1.5">`;
        
        group.items.forEach(item => {
            const timeStr = item.time > 0 ? `<span class="float-right font-mono text-slate-500">${item.time.toFixed(1)} mins</span>` : '';
            laborHtml += `<li class="flex justify-between border-b border-slate-100 pb-1"><span><span class="border border-slate-300 w-3 h-3 inline-block mr-2 translate-y-0.5"></span>${item.label}</span> ${timeStr}</li>`;
        });
        laborHtml += `</ul></div>`;
    }

    // 3. EXTRACT BILL OF MATERIALS & CUT LIST (From build.bom payload)
    let bomHtml = '';
    if (calcResult.build && calcResult.build.bom) {
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

    // 4. GENERATE THE PRINT WINDOW HTML
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString();
    const orderNum = Math.floor(Math.random() * 90000) + 10000; // Placeholder until Job IDs are wired

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
            /* Force SVG strokes to render crisply in print */
            svg { max-height: 350px !important; width: auto !important; margin: 0 auto; display: block; }
        </style>
    </head>
    <body class="font-sans text-slate-900 p-8 max-w-4xl mx-auto border border-slate-200 min-h-screen flex flex-col relative">
        
        <!-- HEADER -->
        <div class="flex justify-between items-start border-b-4 border-slate-900 pb-4 mb-6 shrink-0">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-slate-900 text-white flex items-center justify-center font-black text-xl rounded">SF</div>
                <div>
                    <h1 class="text-2xl font-black uppercase tracking-tight leading-none m-0">Manufacturing Work Order</h1>
                    <span class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">SignFabricator OS • Shop Floor Instructions</span>
                </div>
            </div>
            <div class="text-right">
                <div class="text-xl font-black font-mono">#WO-${orderNum}</div>
                <div class="text-xs text-slate-500 uppercase font-bold mt-1">Generated: ${dateStr}</div>
            </div>
        </div>

        <div class="flex flex-col gap-6 flex-1">
            
            <!-- TOP SECTION: DRAWING & DESCRIPTION -->
            <div class="grid grid-cols-3 gap-6 shrink-0 avoid-break">
                <div class="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-4 relative flex flex-col">
                    <span class="absolute top-2 left-2 text-[8px] font-black text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">Architectural Draft / Physics Map</span>
                    <div class="flex-1 flex items-center justify-center pt-6">
                        ${svgHtml}
                    </div>
                </div>
                
                <div class="col-span-1 flex flex-col gap-4">
                    <div class="border border-slate-200 rounded-lg overflow-hidden flex-1 flex flex-col">
                        <div class="bg-slate-100 px-3 py-1.5 border-b border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-600">Job Description & Specs</div>
                        <div class="p-3 text-[10px] font-mono text-slate-700 whitespace-pre-wrap leading-relaxed flex-1">${jobDesc}</div>
                    </div>
                    <div class="bg-slate-900 text-white rounded-lg p-3 flex justify-between items-center shadow-md">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Est. Run Time</span>
                        <span class="text-sm font-mono font-bold text-emerald-400">${(totalShopMins / 60).toFixed(2)} Hrs</span>
                    </div>
                </div>
            </div>

            <!-- BOTTOM SECTION: BOM & LABOR -->
            <div class="grid grid-cols-2 gap-8 flex-1">
                
                <!-- Bill of Materials -->
                <div class="flex flex-col h-full border border-slate-200 rounded-lg overflow-hidden">
                    <div class="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center shrink-0">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-700">Bill of Materials / Pull List</span>
                        <span class="text-[9px] font-bold text-slate-500 uppercase">Inc. Expected Drop & Waste</span>
                    </div>
                    <div class="p-5 flex-1">
                        ${bomHtml || '<div class="text-[10px] text-slate-400 italic">No materials calculated for this module.</div>'}
                    </div>
                </div>

                <!-- Labor Execution -->
                <div class="flex flex-col h-full border border-slate-200 rounded-lg overflow-hidden">
                    <div class="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center shrink-0">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-700">Fabrication Steps (Labor)</span>
                        <span class="text-[9px] font-bold text-slate-500 uppercase">Check off when complete</span>
                    </div>
                    <div class="p-5 flex-1">
                        ${laborHtml || '<div class="text-[10px] text-slate-400 italic">No labor tasks calculated for this module.</div>'}
                    </div>
                </div>

            </div>
        </div>

        <!-- FOOTER SIGNOFF -->
        <div class="mt-6 pt-4 border-t-2 border-slate-800 grid grid-cols-3 gap-4 shrink-0 text-[9px] font-bold uppercase text-slate-500">
            <div>
                <div class="mb-4">Fabricator Signature:</div>
                <div class="border-b border-slate-400 w-48"></div>
            </div>
            <div>
                <div class="mb-4">QA / Final Inspection:</div>
                <div class="border-b border-slate-400 w-48"></div>
            </div>
            <div class="text-right flex flex-col justify-end">
                Page 1 of 1 • Internal Shop Use Only
            </div>
        </div>
        
        <script>
            // Wait for Tailwind to load and SVG to settle before popping the print dialog
            window.onload = () => { setTimeout(() => window.print(), 800); }
        </script>
    </body>
    </html>
    `);
    
    printWindow.document.close();
};