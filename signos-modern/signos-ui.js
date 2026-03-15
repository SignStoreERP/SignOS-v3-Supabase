/**
 * SignOS UI Component Builder (v1.4)
 * Agnostic generators for Swatches, Grids, Icons, Loaders, and 3D Cameras.
 */
window.SignOS_UI = {

    // --- GLOBAL 3D ISOMETRIC CAMERA ---
    Camera3D: {
        panX: 0, panY: 0, scaleZ: 1, isDragging: false, startX: 0, startY: 0, is3D: false, stageId: '',
        init: function(stageId) { this.stageId = stageId; this.reset(); },
        toggle: function(is3D) { this.is3D = is3D; if(!is3D) this.reset(); },
        handleZoom: function(e) {
            if(!this.is3D) return; 
            e.preventDefault();
            this.scaleZ += e.deltaY * -0.001; 
            this.scaleZ = Math.min(Math.max(0.4, this.scaleZ), 3);
            this.update();
        },
        startPan: function(e) { 
            if(!this.is3D) return; 
            this.isDragging = true; 
            this.startX = e.clientX - this.panX; 
            this.startY = e.clientY - this.panY; 
        },
        handlePan: function(e) { 
            if(!this.isDragging || !this.is3D) return; 
            this.panX = e.clientX - this.startX; 
            this.panY = e.clientY - this.startY; 
            this.update(); 
        },
        endPan: function() { this.isDragging = false; },
        reset: function() { this.panX = 0; this.panY = 0; this.scaleZ = 1; this.update(); },
        update: function() {
            const stage = document.getElementById(this.stageId);
            if(stage) {
                stage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scaleZ})`;
                stage.style.transition = this.isDragging ? 'none' : 'transform 0.2s ease-out'; 
            }
        }
    },

    // --- LABELED COLOR GRID INJECTOR (For Modals) ---
    buildLabeledColorGrid: function(config) {
        const grid = document.getElementById(config.containerId);
        if(!grid) return;
        grid.innerHTML = '';
        const search = config.searchQuery ? config.searchQuery.toLowerCase() : '';

        config.data.forEach(item => {
            const name = item.Name || item.Cap_Color || item.Display_Name || '';
            const code = item.Code || item.Item_Code || item.Color_Code || '';

            if (search && !name.toLowerCase().includes(search) && !code.toLowerCase().includes(search)) return;

            let hex = item.Hex_Code || item.Cap_Hex || '#ffffff';
            let core = item.Core_Hex || '#000000';
            if (hex === 'Transparent' || name.includes('Clear')) hex = '#e5e7eb';

            let bgStyle = `background-color: ${hex};`;
            if (config.type === 'rowmark' && item.Core_Hex && hex !== '#e5e7eb') {
                bgStyle = `background: linear-gradient(135deg, ${hex} 50%, ${core} 50%);`;
            }

            // Dynamically constructs the full labeled button
            const btn = document.createElement('button');
            btn.className = "flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-200 transition w-[72px] focus:outline-none border border-transparent hover:border-gray-300";
            btn.innerHTML = `
                <div class="w-10 h-10 rounded-full border border-gray-400 shadow-sm shrink-0" style="${bgStyle}"></div>
                <span class="text-[9px] font-bold text-gray-700 text-center leading-tight w-full break-words">${name}</span>
                <span class="text-[8px] font-black text-gray-400">${code}</span>
            `;
            // Securely binds the exact data object to the click event
            btn.onclick = () => { if(config.onSelect) config.onSelect(item); };
            grid.appendChild(btn);
        });
    },

    buildIconGrid: function(config) {
        const grid = document.getElementById(config.containerId);
        if (!grid) return;
        grid.innerHTML = '';
        
        const fragment = document.createDocumentFragment();

        (config.data || []).forEach(item => {
            const btn = document.createElement('button');
            btn.className = "w-12 h-12 rounded-lg border-2 border-gray-200 bg-white text-gray-700 shadow-sm hover:border-blue-500 flex items-center justify-center transition focus:outline-none flex-shrink-0 p-2";
            btn.dataset.code = item.Item_Code;
            btn.title = item.Name;
            
            const vBox = item.ViewBox || "0 0 100 100";
            btn.innerHTML = `<svg viewBox="${vBox}" class="w-full h-full" fill="currentColor"><path d="${item.SVG_Path}"></path></svg>`;
            
            btn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-blue-500');
                btn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-blue-500', 'border-transparent');
                if(config.onSelect) config.onSelect(item);
            };
            fragment.appendChild(btn);
        });
        grid.appendChild(fragment);
    },

    _clearActive: function(grid, ringClass) {
        Array.from(grid.children).forEach(b => b.classList.remove('ring-2', 'ring-offset-1', ringClass, 'border-transparent'));
    },

    // --- UTILITIES ---
    filterGrid: function(gridId, inputId) {
        const val = document.getElementById(inputId).value.toLowerCase();
        const grid = document.getElementById(gridId);
        if(!grid) return;
        
        Array.from(grid.children).forEach(btn => {
            if(btn.dataset.search) {
                btn.style.display = btn.dataset.search.includes(val) ? '' : 'none';
            }
        });
    },

    // --- GLOBAL LOADER OVERLAYS ---
    showLoader: function(containerId, message = "Connecting to Source Data...") {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        let overlay = document.getElementById(containerId + '-loader');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = containerId + '-loader';
            overlay.className = "absolute inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl";
            container.appendChild(overlay);
        }
        
        overlay.innerHTML = `
            <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-2"></div>
            <span class="text-[9px] font-black text-blue-400 uppercase tracking-widest animate-pulse mt-3 text-center leading-relaxed">${message}</span>
        `;
        overlay.classList.remove('hidden');
    },

    hideLoader: function(containerId, isError = false, errorMsg = "⚠️ Connection Failed") {
        const overlay = document.getElementById(containerId + '-loader');
        if (!overlay) return;
        
        if (isError) {
            overlay.innerHTML = `<span class="text-[10px] font-black text-red-500 uppercase tracking-widest">${errorMsg}</span>`;
        } else {
            overlay.classList.add('hidden');
        }
    },

    // --- SCHEMA-DRIVEN UI INJECTORS ---
    injectColorModal: function() {
        if(document.getElementById('color-modal')) return; // Prevent duplicates
        const html = `
        <div id="color-modal" class="hidden fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity cursor-pointer" onclick="if(window.closeModal) window.closeModal()">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden border border-gray-200 cursor-auto" onclick="event.stopPropagation()">
                <div class="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-xs" id="modal-title">Select Color</h3>
                    <button onclick="if(window.closeModal) window.closeModal()" class="text-gray-400 hover:text-red-500 font-bold transition focus:outline-none text-lg">✕</button>
                </div>
                <div class="p-3 shrink-0 border-b border-gray-100 flex flex-col gap-2">
                    <input type="text" id="color-search" placeholder="Search colors..." oninput="if(window.renderColorGrid) window.renderColorGrid()" class="w-full border border-gray-300 rounded p-2 text-xs font-bold outline-none focus:border-blue-500 shadow-inner">
                </div>
                <div id="modal-grid" class="p-4 overflow-y-auto custom-scroll flex flex-wrap gap-2 content-start bg-gray-50 flex-1"></div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
};