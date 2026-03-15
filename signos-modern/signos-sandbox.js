/**
 * SignOS Universal Cost Sandbox & Ledger (v4.2 - Bidirectional Hover Sync)
 */
window.SignOS_Sandbox = {
    config: null, backendData: null, simData: null, triggerCalc: null, lastResult: null, isOpen: false, isInline: false,

    init: function(productConfig, initialBackendData, calcFunction) {
        this.config = productConfig; this.backendData = initialBackendData;
        this.simData = { ...initialBackendData }; this.triggerCalc = calcFunction;
        this.isInline = !!(document.getElementById('sandbox-ledger') && document.getElementById('sandbox-vars'));
        if (!this.isInline) this.injectDrawerUI();
        this.buildInputs();
    },

    toggle: function() {
        this.isOpen = !this.isOpen;
        if (this.isInline) {
            const wrap = document.getElementById('app-wrapper');
            const left = document.getElementById('sandbox-ledger'), right = document.getElementById('sandbox-vars');
            if (this.isOpen) {
                wrap.classList.replace('max-w-md', 'max-w-[1200px]');
                left.classList.replace('hidden', 'flex'); right.classList.replace('hidden', 'flex');
                if(!this.simData) this.reset();
            } else {
                wrap.classList.replace('max-w-[1200px]', 'max-w-md');
                left.classList.replace('flex', 'hidden'); right.classList.replace('flex', 'hidden');
            }
        }
    },

    reset: function() { this.simData = { ...this.backendData }; this.buildInputs(); if (this.triggerCalc) this.triggerCalc(); },

    apply: function() {
        if (!this.simData) this.simData = { ...this.backendData };
        const harvest = (arr) => {
            if(!arr) return;
            arr.forEach(i => {
                let el = document.getElementById(`sbx_${i.key}`) || document.getElementById(`glb_sbx_${i.key}`);
                if (el && el.value !== "") this.simData[i.key] = parseFloat(el.value) || el.value;
            });
        };
        harvest(this.config.retails); harvest(this.config.costs);
        if (this.triggerCalc) this.triggerCalc();
    },

    buildInputs: function() {
        const buildSection = (arr, containerId) => {
            if(!arr || !document.getElementById(containerId)) return;
            let html = '';
            const prefix = this.isInline ? 'sbx_' : 'glb_sbx_';

            arr.forEach(i => {
                let v = this.simData[i.key] !== undefined ? this.simData[i.key] : '';
                if (v !== '' && !isNaN(v) && (i.label.includes('$') || i.label.includes('Rate'))) v = parseFloat(v).toFixed(2);
                let desc = this.backendData['META_NOTE_' + i.key] || i.desc || "System parameter.";
                
                // HOVER-VAR HOOKS APPLIED HERE
                html += `
                <div id="wrap_${prefix}${i.key}" class="flex justify-between items-center gap-2 py-0.5 transition-opacity duration-300">
                    <label class="text-[10px] font-bold text-gray-600 truncate flex-1 hover-var cursor-help transition-all" data-var="${i.key}" title="${desc}">${i.label}</label>
                    <input type="text" id="${prefix}${i.key}" value="${v}" class="w-16 bg-gray-50 border border-gray-300 text-gray-800 text-[10px] font-bold text-center rounded outline-none focus:border-blue-400 focus:bg-white shadow-inner py-1 hover-var" data-var="${i.key}">
                </div>`;
            });
            document.getElementById(containerId).innerHTML = html;
        };

        const rId = this.isInline ? 'glb-sbx-retail-inputs' : 'glb-sbx-retail-inputs'; 
        const cId = this.isInline ? 'glb-sbx-cost-inputs' : 'glb-sbx-cost-inputs';
        buildSection(this.config.retails, rId); buildSection(this.config.costs, cId);
    },

    renderLedger: function(res) {
        this.lastResult = res; const fmt = (n) => "$" + (parseFloat(n)||0).toFixed(2);
        if (!res || !res.cost || !res.cost.breakdown) return;

        const renderSection = (id, data, title, total) => {
            const el = document.getElementById(id);
            if (!el) return;
            let html = data.map(i => `
            <div class="mb-2 border-b border-gray-100 pb-1.5">
                <div class="flex justify-between text-[11px] ${id.includes('retail')?'text-blue-800':'text-red-800'} font-bold tracking-wide"><span>${i.label}</span><span class="font-mono">${fmt(i.total)}</span></div>
                <div class="text-[9px] text-gray-500 font-mono italic mt-0.5 tracking-tight">↳ Math: ${i.formula || ''}</div>
            </div>`).join('');
            html += `<div class="flex justify-between text-[12px] font-black ${id.includes('retail')?'text-blue-700 border-blue-200':'text-red-700 border-red-200'} mt-2 pt-2 border-t-2"><span>${title}:</span><span>${fmt(total)}</span></div>`;
            el.innerHTML = html;
        };

        renderSection('glb-sbx-retail-breakdown', res.retail.breakdown, 'Gross Retail', res.retail.grandTotal);
        renderSection('glb-sbx-cost-breakdown', res.cost.breakdown, 'Total Hard Cost', res.cost.total);

        const margin = res.metrics.margin * 100;
        const mEl = document.getElementById('glb-sbx-margin');
        if (mEl) {
            mEl.innerText = margin.toFixed(1) + '%';
            mEl.className = margin >= 50 ? 'text-2xl font-black text-green-600 tracking-tight leading-none' : (margin > 0 ? 'text-2xl font-black text-yellow-600 tracking-tight leading-none' : 'text-2xl font-black text-red-600 tracking-tight leading-none');
        }
    }
};

// --- GLOBAL BIDIRECTIONAL HOVER ENGINE ---
document.addEventListener('mouseover', e => {
    const target = e.target.closest('.hover-var');
    if(target) {
        const varName = target.getAttribute('data-var');
        document.querySelectorAll(`.hover-var[data-var="${varName}"]`).forEach(el => {
            el.style.backgroundColor = '#fef08a'; el.style.color = '#854d0e'; el.style.borderRadius = '4px';
        });
        const inputEl = document.getElementById(`glb_sbx_${varName}`) || document.getElementById(`sbx_${varName}`);
        if(inputEl) { inputEl.style.backgroundColor = '#fef08a'; inputEl.style.borderColor = '#eab308'; }
    }
});

document.addEventListener('mouseout', e => {
    const target = e.target.closest('.hover-var');
    if(target) {
        const varName = target.getAttribute('data-var');
        document.querySelectorAll(`.hover-var[data-var="${varName}"]`).forEach(el => { el.style.backgroundColor = ''; el.style.color = ''; });
        const inputEl = document.getElementById(`glb_sbx_${varName}`) || document.getElementById(`sbx_${varName}`);
        if(inputEl) { inputEl.style.backgroundColor = ''; inputEl.style.borderColor = ''; }
    }
});