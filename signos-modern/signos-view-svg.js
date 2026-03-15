/**
 * SignOS Universal Spatial Preview Tool (v4.0)
 * Generates 2D/3D physics-accurate previews from a standardized layer manifest.
 */
window.SignOS_View = {
    render: function(containerId, manifest) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const w = manifest.w || 8;
        const h = manifest.h || 8;
        const is3D = manifest.is3D !== false; // default true
        
        const scale = Math.min(180 / w, 150 / h);
        container.style.width = `${w * scale}px`;
        container.style.height = `${h * scale}px`;

        let html = '';
        
        // Sort by Z to ensure proper physical stacking from back to front
        let stack = [...manifest.layers].sort((a, b) => a.z - b.z);
        
        stack.forEach((l, i) => {
            const isTactile = l.isTactile;
            const bgHex = isTactile ? 'transparent' : (l.hex || '#cccccc');
            
            // Generate physically scaled Z-transforms
            const currentZ = is3D ? (l.z * 15) : 0;
            const shadow = isTactile ? 'none' : (is3D ? `-${l.z+1}px ${l.z+1}px 4px rgba(0,0,0,0.3)` : '0 1px 3px rgba(0,0,0,0.1)');
            const borderClass = isTactile ? '' : 'border border-black/20';
            
            let content = l.content || '';
            
            // Structural Routing: Render the dashed window on the specified layer
            if (l.isWindow && !isTactile) {
                content += `<div class="absolute bottom-[10%] left-[5%] right-[5%] h-[20%] border border-dashed border-black/40 bg-black/10 flex items-center justify-center text-[6px] font-black text-black/50 tracking-widest" style="box-shadow: inset 1px -1px 3px rgba(0,0,0,0.2);">ROUTED POCKET</div>`;
            }

            // Cascade Callout logic (prevents tooltips from overlapping visually)
            let cascadeY = is3D ? ((stack.length - 1 - i) * 15) : 0;

            html += `
            <div class="absolute inset-0 ${borderClass} rounded flex transition-all duration-700 ease-in-out pointer-events-none"
                 style="background-color: ${bgHex}; box-shadow: ${shadow}; transform: translateZ(${currentZ}px);">
                ${content}
                ${is3D ? `
                <div class="blueprint-callout absolute right-[100%] top-1/2 flex items-center z-50 mr-3 pointer-events-none" style="transform: translateY(calc(-50% + ${cascadeY}px));">
                    <span class="text-[6px] font-black text-blue-700 uppercase tracking-widest bg-white/90 backdrop-blur px-1.5 py-0.5 rounded border border-blue-200 shadow-sm whitespace-nowrap">${l.role}</span>
                    <div class="w-6 border-b-[1.5px] border-blue-500 shadow-sm"></div>
                </div>` : ''}
            </div>`;
        });
        
        container.innerHTML = html;
    }
};