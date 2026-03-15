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

    // --- SWATCH & ICON GRIDS ---
    buildColorGrid: function(config) {
        const grid = document.getElementById(config.containerId);
        if(!grid) return;
        grid.innerHTML = '';

        if(config.showCustom) {
            const customBtn = document.createElement('button');
            customBtn.className = "w-8 h-8 rounded-full border-2 border-dashed border-gray-400 text-gray-500 hover:text-blue-600 hover:border-blue-500 flex items-center justify-center font-bold text-xs bg-gray-50 transition";
            customBtn.innerHTML = "+";
            customBtn.title = "Custom Manual Input";
            customBtn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-blue-500');
                customBtn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-blue-500', 'border-transparent');
                if(config.onCustom) config.onCustom();
            };
            grid.appendChild(customBtn);
        }

        const fragment = document.createDocumentFragment();

        config.data.forEach(item => {
            const btn = document.createElement('button');
            btn.className = `w-8 h-8 rounded border border-gray-300 shadow-sm hover:scale-110 transition focus:outline-none relative group overflow-hidden shrink-0 ${config.btnClass || ''}`;
            
            let bgStyle = '';
            let title = '';
            let searchData = '';

            if (config.type === 'rowmark') {
                let code = item.Item_Code || item.Code || '';
                let name = item.Cap_Color || item.Name || '';
                let cap = item.Cap_Hex || item.Hex_Code || '#ffffff';
                let core = item.Core_Hex || '#000000';
                
                if (cap === 'Transparent' || name.includes('Clear')) cap = '#e5e7eb';
                if (core === 'Transparent') core = '#e5e7eb';
                
                if (config.isReverse) bgStyle = `linear-gradient(135deg, ${core} 50%, ${cap} 50%)`;
                else bgStyle = cap;
                
                title = `${name} (${code})`;
                searchData = title.toLowerCase();
                btn.dataset.code = code;

            } else if (config.type === 'paint' || config.type === 'vinyl') {
                bgStyle = item.Hex_Code || '#FFFFFF';
                let code = item.Code || item.Color_Code || '';
                let name = item.Name || item.Display_Name || '';
                title = `${name} (${code})`;
                searchData = title.toLowerCase();
                if(config.type === 'paint') btn.classList.add('rounded-full');
            }

            btn.style.background = bgStyle;
            btn.title = title;
            btn.dataset.search = searchData;

            btn.onclick = () => {
                this._clearActive(grid, config.activeRingClass || 'ring-blue-500');
                btn.classList.add('ring-2', 'ring-offset-1', config.activeRingClass || 'ring-blue-500', 'border-transparent');
                if(config.onSelect) config.onSelect(item);
            };

            fragment.appendChild(btn);
        });

        grid.appendChild(fragment);
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