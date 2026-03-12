/**
 * SignOS Canvas & Physics Render Engine (v1.0)
 * Centralizes Typography Limits, Font Loading, and Dimension Snapping.
 */

window.SignOS_Canvas = {
    
    // Dynamically creates CSS rules to mount custom TTF files from GitHub
    loadFonts: function(fontArray) {
        if(!fontArray || fontArray.length === 0) return;
        let fontStyles = document.createElement('style');
        
        fontArray.forEach(f => {
            fontStyles.innerHTML += `
            @font-face {
                font-family: '${f.CSS_Family}';
                src: url('https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/${f.File_Name}') format('truetype');
            }
            .font-dyn-${f.CSS_Family} { font-family: '${f.CSS_Family}', sans-serif; }
            `;
        });
        document.head.appendChild(fontStyles);
    },

    // The True Physics Font-Scaler: Returns the absolute max physical height a string can be within a given width
    calcMaxHeightForText: function(text, fontStyle, availableW) {
        if(!text) return 999;
        
        let canvas = document.getElementById('signos-math-canvas');
        if(!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'signos-math-canvas';
            canvas.className = 'hidden';
            document.body.appendChild(canvas);
        }
        
        const ctx = canvas.getContext('2d');
        ctx.font = `500 100px "${fontStyle}", sans-serif`;
        const wPx = ctx.measureText(text).width;
        if(wPx === 0) return 999;
        
        const capRatio = 0.72; // Standard cap-height block ratio
        const scaleToFitWidth = availableW / (wPx / 100); 
        return scaleToFitWidth * capRatio;
    },

    // Global Parent-Sheet bounding box constraints
    enforceSheetLimits: function(wId, hId, warnId, maxShort = 48, maxLong = 96) {
        let wEl = document.getElementById(wId);
        let hEl = document.getElementById(hId);
        let warnEl = document.getElementById(warnId);
        if (!wEl || !hEl) return false;

        let w = parseFloat(wEl.value) || 0;
        let h = parseFloat(hEl.value) || 0;
        let didClamp = false;

        if (w > maxLong) { w = maxLong; wEl.value = w; didClamp = true; }
        if (h > maxLong) { h = maxLong; hEl.value = h; didClamp = true; }
        if (w > maxShort && h > maxShort) {
            if (w > h) { h = maxShort; hEl.value = h; } else { w = maxShort; wEl.value = w; }
            didClamp = true;
        }

        if (didClamp && warnEl) {
            warnEl.classList.remove('hidden');
            clearTimeout(warnEl.timeoutId);
            warnEl.timeoutId = setTimeout(() => warnEl.classList.add('hidden'), 3000);
        }
        return didClamp;
    }
};
