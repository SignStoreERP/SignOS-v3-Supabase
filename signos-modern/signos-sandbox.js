/**
 * SignOS Universal Cost Sandbox & Ledger (v4.1 - Dual-Mode)
 * Automatically detects if the calculator has an inline 3-column layout. 
 * If not, it injects a global off-canvas drawer.
 */
window.SignOS_Sandbox = {
    config: null,
    backendData: null,
    simData: null,
    triggerCalc: null,
    lastResult: null,
    isOpen: false,
    isInline: false,

    init: function(productConfig, initialBackendData, calcFunction) {
        this.config = productConfig;
        this.backendData = initialBackendData;
        this.simData = { ...initialBackendData };
        this.triggerCalc = calcFunction;
        
        // Dual-Mode Sensor: Check if the HTML has 3-Column Placeholders
        if (document.getElementById('sandbox-ledger') && document.getElementById('sandbox-vars')) {
            this.isInline = true;
        } else {
            this.isInline = false;
            this.injectDrawerUI();
        }
        
        this.buildInputs();
    },

    toggle: function() {
        this.isOpen = !this.isOpen;

        // INLINE 3-COLUMN MODE
        if (this.isInline) {
            const wrap = document.getElementById('app-wrapper');
            const left = document.getElementById('sandbox-ledger');
            const right = document.getElementById('sandbox-vars');
            
            if (this.isOpen) {
                wrap.classList.remove('max-w-md', 'max-w-lg', 'max-w-xl');
                wrap.classList.add('max-w-[1200px]');
                left.classList.remove('hidden'); left.classList.add('flex');
                right.classList.remove('hidden'); right.classList.add('flex');
                if(!this.simData) { this.reset(); }
            } else {
                wrap.classList.add('max-w-md'); // Safely snaps back to center column width
                wrap.classList.remove('max-w-[1200px]');
                left.classList.add('hidden'); left.classList.remove('flex');
                right.classList.add('hidden'); right.classList.remove('flex');
            }
            return;
        }

        // OFF-CANVAS DRAWER MODE
        const drawer = document.getElementById('glb-sandbox-drawer');
        const overlay = document.getElementById('glb-sandbox-overlay');
        if (this.isOpen) {
            drawer.classList.remove('translate-x-full');
            overlay.classList.remove('hidden');
            if(!this.simData) { this.reset(); }
        } else {
            drawer.classList.add('translate-x-full');
            overlay.classList.add('hidden');
        }
    },

    reset: function() {
        this.simData = { ...this.backendData };
        this.buildInputs();
        if (this.triggerCalc) this.triggerCalc();
    },

    apply: function() {
        if (!this.simData) this.simData = { ...this.backendData };
        
        const harvest = (arr) => {
            if(!arr) return;
            arr.forEach(i => {
                let el = document.getElementById(`glb_sbx_${i.key}`);
                if (el && el.value !== "") this.simData[i.key] = parseFloat(el.value) || el.value;
            });
        };
        
        harvest(this.config.retails);
        harvest(this.config.costs);
        
        if (this.triggerCalc) this.triggerCalc();
    },

    buildInputs: function() {
        const buildSection = (arr, containerId) => {
            if(!arr || !document.getElementById(containerId)) return;
            let html = '';
            arr.forEach(i => {
                let v = this.simData[i.key] !== undefined ? this.simData[i.key] : '';
                if (v !== '' && !isNaN(v) && (i.label.includes('$') || i.label.includes('Rate'))) v = parseFloat(v).toFixed(2);
                let desc = this.backendData['META_NOTE_' + i.key] || i.desc || "";
                
                html += `
                <div class="flex justify-between items-center gap-2 py-0.5">
                    <label class="text-[10px] font-bold text-gray-600 truncate flex-1 cursor-help" title="${desc}">${i.label}</label>
                    <input type="text" id="glb_sbx_${i.key}" value="${v}" class="w-16 bg-gray-50 border border-gray-300 text-gray-800 text-[10px] font-bold text-center rounded outline-none focus:border-blue-400 focus:bg-white shadow-inner py-1">
                </div>`;
            });
            document.getElementById(containerId).innerHTML = html;
        };

        buildSection(this.config.retails, 'glb-sbx-retail-inputs');
        buildSection(this.config.costs, 'glb-sbx-cost-inputs');
    },

    renderLedger: function(res) {
        this.lastResult = res;
        const fmt = (n) => "$" + (parseFloat(n)||0).toFixed(2);
        
        if (!res || !res.cost || !res.cost.breakdown) return;

        // Render Retail Breakdown
        const retBreakdownEl = document.getElementById('glb-sbx-retail-breakdown');
        if (retBreakdownEl) {
            let retHtml = res.retail.breakdown.map(i => `
                <div class="mb-2 border-b border-gray-100 pb-1.5">
                    <div class="flex justify-between text-[11px] text-blue-800 font-bold tracking-wide"><span>${i.label}</span><span class="font-mono">${fmt(i.total)}</span></div>
                    <div class="text-[9px] text-gray-500 font-mono italic mt-0.5">↳ ${i.formula || ''}</div>
                </div>`).join('');
            retHtml += `<div class="flex justify-between text-[12px] font-black text-blue-700 mt-2 pt-2 border-t-2 border-blue-200"><span>Gross Retail:</span><span>${fmt(res.retail.grandTotal)}</span></div>`;
            retBreakdownEl.innerHTML = retHtml;
        }

        // Render Cost Breakdown
        const cstBreakdownEl = document.getElementById('glb-sbx-cost-breakdown');
        if (cstBreakdownEl) {
            let cstHtml = res.cost.breakdown.map(i => `
                <div class="mb-2 border-b border-gray-100 pb-1.5">
                    <div class="flex justify-between text-[11px] text-red-800 font-bold tracking-wide"><span>${i.label}</span><span class="font-mono">${fmt(i.total)}</span></div>
                    <div class="text-[9px] text-gray-500 font-mono italic mt-0.5">↳ ${i.formula || ''}</div>
                </div>`).join('');
            cstHtml += `<div class="flex justify-between text-[12px] font-black text-red-700 mt-2 pt-2 border-t-2 border-red-200"><span>Total Hard Cost:</span><span>${fmt(res.cost.total)}</span></div>`;
            cstBreakdownEl.innerHTML = cstHtml;
        }

        // Render Margin
        const margin = res.metrics.margin * 100;
        const mEl = document.getElementById('glb-sbx-margin');
        if (mEl) {
            mEl.innerText = margin.toFixed(1) + '%';
            mEl.className = margin >= 50 ? 'text-2xl font-black text-green-600 tracking-tight leading-none' : (margin > 0 ? 'text-2xl font-black text-yellow-600 tracking-tight leading-none' : 'text-2xl font-black text-red-600 tracking-tight leading-none');
        }
    },

    exportTXT: function() {
        if(!this.lastResult) return;
        const fmt = (n) => "$" + (n||0).toFixed(2);
        const cleanHTML = (str) => str.replace(/<[^>]*>?/gm, '');
        
        let txt = `SIGNOS V4.0 - UNIVERSAL LEDGER EXHAUST\nTimestamp: ${new Date().toISOString()}\n----------------------------------------\n\n`;
        
        txt += `--- MARKET LEDGER (RETAIL) ---\n`;
        this.lastResult.retail.breakdown.forEach(i => txt += `${i.label.padEnd(35)} ${fmt(i.total)}\n  [Math: ${cleanHTML(i.formula)}]\n`);
        txt += `----------------------------------------\nGROSS RETAIL: ${fmt(this.lastResult.retail.grandTotal)}\n\n`;
        
        txt += `--- PHYSICS LEDGER (COST) ---\n`;
        this.lastResult.cost.breakdown.forEach(i => txt += `${i.label.padEnd(35)} ${fmt(i.total)}\n  [Math: ${cleanHTML(i.formula)}]\n`);
        txt += `----------------------------------------\nHARD COST TOTAL: ${fmt(this.lastResult.cost.total)}\n\n`;
        
        txt += `NET MARGIN: ${(this.lastResult.metrics.margin*100).toFixed(1)}%`;
        
        const blob = new Blob([txt], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `SignOS_Ledger_Export_${Date.now()}.txt`;
        a.click();
    },

    injectDrawerUI: function() {
        if(document.getElementById('glb-sandbox-drawer')) return;
        const html = `
        <div id="glb-sandbox-overlay" class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 hidden transition-opacity" onclick="SignOS_Sandbox.toggle()"></div>
        <div id="glb-sandbox-drawer" class="fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 transform translate-x-full transition-transform duration-300 flex flex-col border-l border-gray-200">
            <div class="p-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center shrink-0">
                <div>
                    <h2 class="text-sm font-black text-gray-800 uppercase tracking-widest">Universal Cost Sandbox</h2>
                    <span class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Market vs. Physics Simulation</span>
                </div>
                <button onclick="SignOS_Sandbox.toggle()" class="text-gray-400 hover:text-red-500 transition font-bold text-lg">✕</button>
            </div>
            <div class="flex-1 overflow-y-auto custom-scroll p-5 space-y-6">
                <!-- LEDGER -->
                <div class="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200 shadow-sm">
                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Simulated Margin:</span>
                    <span id="glb-sbx-margin" class="text-2xl font-black text-gray-400 tracking-tight leading-none">--</span>
                </div>
                <div>
                    <h3 class="text-[11px] font-black text-blue-700 uppercase tracking-widest border-b-2 border-blue-100 pb-2 mb-3">Market Logic (Retail)</h3>
                    <div id="glb-sbx-retail-breakdown" class="space-y-3 mb-4 text-xs italic text-gray-400">Run simulation to view ledger...</div>
                </div>
                <div>
                    <h3 class="text-[11px] font-black text-red-700 uppercase tracking-widest border-b-2 border-red-100 pb-2 mb-3">Physics Engine (Hard Cost)</h3>
                    <div id="glb-sbx-cost-breakdown" class="space-y-3 text-xs italic text-gray-400">Run simulation to view ledger...</div>
                </div>
                <!-- VARIABLES -->
                <div class="pt-6 border-t border-gray-200">
                    <h3 class="text-[11px] font-black text-gray-800 uppercase tracking-widest mb-4">Override Variables</h3>
                    <span class="text-[10px] font-black text-blue-700 uppercase tracking-widest border-b border-blue-200 pb-1 mb-2 block">Market Variables</span>
                    <div id="glb-sbx-retail-inputs" class="space-y-2 mb-6"></div>
                    <span class="text-[10px] font-black text-red-700 uppercase tracking-widest border-b border-red-200 pb-1 mb-2 block">Physics Variables</span>
                    <div id="glb-sbx-cost-inputs" class="space-y-2"></div>
                </div>
            </div>
            <div class="p-4 bg-slate-50 border-t border-gray-200 shrink-0 space-y-2">
                <button onclick="SignOS_Sandbox.apply()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded shadow text-xs uppercase tracking-widest transition">Apply & Simulate</button>
                <div class="flex gap-2">
                    <button onclick="SignOS_Sandbox.reset()" class="flex-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 font-bold py-2 rounded text-[10px] uppercase tracking-widest transition shadow-sm">Reset</button>
                    <button onclick="SignOS_Sandbox.exportTXT()" class="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 rounded text-[10px] uppercase tracking-widest transition shadow-sm">Export TXT</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
};

// --- GLOBAL HOVER SYNCHRONIZATION ENGINE ---
document.addEventListener('mouseover', e => {
    const target = e.target.closest('.hover-var');
    if(target) {
        const varName = target.getAttribute('data-var');
        // Highlight all instances in the ledger
        document.querySelectorAll(`.hover-var[data-var="${varName}"]`).forEach(el => {
            el.style.backgroundColor = '#fef08a'; // yellow-200
            el.style.color = '#854d0e'; // yellow-900
        });
        // Highlight the corresponding input box in the Sandbox
        const inputEl = document.getElementById(`glb_sbx_${varName}`);
        if(inputEl) {
            inputEl.style.backgroundColor = '#fef08a';
            inputEl.style.borderColor = '#eab308';
        }
    }
});

document.addEventListener('mouseout', e => {
    const target = e.target.closest('.hover-var');
    if(target) {
        const varName = target.getAttribute('data-var');
        // Remove highlights
        document.querySelectorAll(`.hover-var[data-var="${varName}"]`).forEach(el => {
            el.style.backgroundColor = '';
            el.style.color = '';
        });
        const inputEl = document.getElementById(`glb_sbx_${varName}`);
        if(inputEl) {
            inputEl.style.backgroundColor = '';
            inputEl.style.borderColor = '';
        }
    }
});