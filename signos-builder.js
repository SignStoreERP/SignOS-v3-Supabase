// signos-builder.js (v4.2 - Unified Nameplate & ADA Architecture)

const SignOS_Builder = {

    // --- 1. EXISTING NAMEPLATES LOGIC (Preserved) ---
    async buildManifest(inputs, lines, githubBase) {
        const safeMatName = inputs.mat && inputs.mat.Item_Code ? `[${inputs.mat.Item_Code}]_${inputs.mat.Cap_Color}`.replace(/[^a-zA-Z0-9\[\]]/g, '_') : 'backer';
        const safePaintName = inputs.isReverse && inputs.paint ? `_Paint_${inputs.paint}`.replace(/[^a-zA-Z0-9\[\]]/g, '_') : '';

        const manifest = {
            width: inputs.w,
            height: inputs.h,
            substrateColor: inputs.mat ? (inputs.mat.Cap_Hex || "#DDDDDD") : "#000000",
            textColor: inputs.isReverse ? (inputs.paintHex || "#FFFFFF") : (inputs.mat ? inputs.mat.Core_Hex : '#FFFFFF'),
            substrateLayerName: `backer_${safeMatName}${safePaintName}`,
            objects: [],
            totalHeight: 0
        };

        const gap = inputs.gap || 0;
        const lineData = [];

        for (let ls of lines) {
            if (!ls.text) continue;
            try {
                const fontUrl = githubBase + encodeURIComponent(ls.fileName);
                const font = await new Promise((res, rej) => opentype.load(fontUrl, (err, f) => err ? rej(err) : res(f)));
                const scale = ls.height / font.ascender;
                const path = font.getPath(ls.text, 0, 0, font.unitsPerEm * scale);
                lineData.push({ text: ls.text, path: path });
            } catch(e) { console.error("Font failed to load", e); }
        }

        if (lineData.length === 0) return manifest;

        let groupMinY = Infinity;
        let groupMaxY = -Infinity;
        let currentY = 0;

        lineData.forEach(ld => {
            const bbox = ld.path.getBoundingBox();
            const yOffset = currentY - bbox.y1;
            ld.yOffset = yOffset;
            ld.xOffset = (inputs.w / 2) - ((bbox.x2 - bbox.x1) / 2) - bbox.x1;

            const trueY1 = bbox.y1 + yOffset;
            const trueY2 = bbox.y2 + yOffset;

            if (trueY1 < groupMinY) groupMinY = trueY1;
            if (trueY2 > groupMaxY) groupMaxY = trueY2;

            currentY = trueY2 + gap;
        });

        manifest.totalHeight = groupMaxY - groupMinY;
        const targetCenterY = inputs.h / 2;
        const currentCenterY = groupMinY + (manifest.totalHeight / 2);
        const finalShiftY = targetCenterY - currentCenterY;

        lineData.forEach(ld => {
            manifest.objects.push({
                d: ld.path.toPathData(5),
                name: ld.text,
                x: ld.xOffset,
                y: ld.yOffset + finalShiftY
            });
        });

        return manifest;
    },

    // --- 2. ADA & TACTILE BRAILLE LOGIC ---
    
    // Accurate Grade 1 Braille Matrix (Federal Standard)
    brailleMap: {
        'a':[1], 'b':[1, 2], 'c':[1, 3], 'd':[1, 3, 4], 'e':[1, 4],
        'f':[1-3], 'g':[1-4], 'h':[1, 2, 4], 'i':[2, 3], 'j':[2-4],
        'k':[1, 5], 'l':[1, 2, 5], 'm':[1, 3, 5], 'n':[1, 3-5], 'o':[1, 4, 5],
        'p':[1-3, 5], 'q':[1-5], 'r':[1, 2, 4, 5], 's':[2, 3, 5], 't':[2-5],
        'u':[1, 5, 6], 'v':[1, 2, 5, 6], 'w':[2-4, 6], 'x':[1, 3, 5, 6], 'y':[1, 3-6], 'z':[1, 4-6],
        ' ': [], '#':[3-6]
    },

    generateBraillePaths: function(text, startX, startY, align) {
        if (!text) return "";
        
        const DOT_PITCH = 0.100;
        const CELL_PITCH = 0.241;
        const DOT_RADIUS = 0.025;

        let str = text.toLowerCase();
        // Insert number sign modifier natively before numbers
        if (/\d/.test(str)) str = "#" + str;

        let totalWidth = str.length * CELL_PITCH;
        
        let cursorX = startX;
        if (align === 'center') cursorX = startX - (totalWidth / 2);
        if (align === 'right') cursorX = startX - totalWidth;

        let paths = "";
        for (let i = 0; i < str.length; i++) {
            let char = str[i];
            let dots = this.brailleMap[char] || [];

            if (char === '#') dots = this.brailleMap['#'];
            else if (/\d/.test(char)) {
                // Map numbers 1-9,0 to letters a-j
                const numMap = ['j','a','b','c','d','e','f','g','h','i'];
                dots = this.brailleMap[numMap[parseInt(char)]] || [];
            }

            // Draw SVG paths for the physical dots
            if(dots.includes(1)) paths += `<circle cx="${cursorX}" cy="${startY}" r="${DOT_RADIUS}" />`;
            if(dots.includes(2)) paths += `<circle cx="${cursorX}" cy="${startY + DOT_PITCH}" r="${DOT_RADIUS}" />`;
            if(dots.includes(3)) paths += `<circle cx="${cursorX}" cy="${startY + (DOT_PITCH*2)}" r="${DOT_RADIUS}" />`;
            if(dots.includes(4)) paths += `<circle cx="${cursorX + DOT_PITCH}" cy="${startY}" r="${DOT_RADIUS}" />`;
            if(dots.includes(5)) paths += `<circle cx="${cursorX + DOT_PITCH}" cy="${startY + DOT_PITCH}" r="${DOT_RADIUS}" />`;
            if(dots.includes(6)) paths += `<circle cx="${cursorX + DOT_PITCH}" cy="${startY + (DOT_PITCH*2)}" r="${DOT_RADIUS}" />`;

            cursorX += CELL_PITCH;
        }
        return paths;
    },

    // Generates Layout Warnings and Absolute Positioned SVGs for ADA signs
    buildADA: async function(inputs, githubBase) {
        const { w, h, align, textVal, hasPicto, hasText, hasBraille, isAutoScale, selectedIcon } = inputs;

        let pictoSize = inputs.pictoSize || 4;
        let fontSize = inputs.fontSize || 0.625;

        // 1. AUTO-SCALE LOGIC
        if (isAutoScale) {
            pictoSize = Math.min(w * 0.6, h * 0.45, 5);
            fontSize = h * 0.08;
        }

        // 2. ADA PHYSICS GUARDRAILS
        let reqHeight = 0.375; // Top Margin
        if (hasPicto) reqHeight += 6.0; // 6 inch minimum field for federal compliance
        if (hasPicto && (hasText || hasBraille)) reqHeight += 0.375; // Gap
        if (hasText) reqHeight += fontSize; 
        if (hasText && hasBraille) reqHeight += 0.375; // Gap
        if (hasBraille) reqHeight += 0.25; 
        reqHeight += 0.375; // Bottom Margin

        let warnMsgs = [];
        if (hasText && fontSize < 0.625) warnMsgs.push("Tactile text height is below the 5/8\" ADA minimum.");
        if (h < reqHeight && (hasPicto || hasText || hasBraille)) warnMsgs.push(`Layout requires ~${reqHeight.toFixed(2)}" vertical space.`);

        // 3. PHYSICAL Y-AXIS SPACING
        let contentH = 0;
        if(hasPicto) contentH += pictoSize;
        if(hasPicto && (hasText || hasBraille)) contentH += 0.5; 
        if(hasText) contentH += fontSize;
        if(hasText && hasBraille) contentH += 0.375; 
        if(hasBraille) contentH += 0.25; 

        let currentY = (h - contentH) / 2;
        if (currentY < 0.375) currentY = 0.375; 

        let pictoY = 0, textY = 0, brailleY = 0;
        if (hasPicto) { pictoY = currentY; currentY += pictoSize; if (hasText || hasBraille) currentY += 0.5; }
        if (hasText) { textY = currentY; currentY += fontSize; if (hasBraille) currentY += 0.375; }
        if (hasBraille) { brailleY = currentY + 0.15; }

        let xPos = w / 2;
        if (align === 'left') xPos = 0.375; 
        if (align === 'right') xPos = w - 0.375;

        // 4. GENERATE SVGS
        let svgContent = '';
        if (hasPicto && selectedIcon) {
            let pX = (w/2) - (pictoSize/2); 
            let viewB = selectedIcon.ViewBox || "0 0 100 100";
            
            // Extract the source width from the ViewBox mapping
            let vParts = viewB.split(' ').map(Number);
            let sourceW = vParts[2] || 100;
            
            // Pure Math: Calculate exact CAD scale ratio instead of using nested SVGs
            let exactScale = pictoSize / sourceW;
            
            svgContent += `<g transform="translate(${pX}, ${pictoY}) scale(${exactScale})" fill="currentColor"><path d="${selectedIcon.SVG_Path}"/></g>`;
        }

        if (hasText && textVal) {
            try {
                const fontUrl = githubBase + encodeURIComponent(inputs.fontFileName);
                const font = await new Promise((res, rej) => opentype.load(fontUrl, (err, f) => err ? rej(err) : res(f)));
                
                // Dry run to measure the raw Opentype bounding box physics
                const rawPath = font.getPath(textVal, 0, 0, font.unitsPerEm);
                const rawBbox = rawPath.getBoundingBox();
                
                // Mathematical scale formula ensures output matches physical requested inches
                const exactScale = fontSize / (rawBbox.y2 - rawBbox.y1);
                const pathObj = font.getPath(textVal, 0, 0, font.unitsPerEm * exactScale);
                const bbox = pathObj.getBoundingBox();
                
                let alignX = xPos;
                if (align === 'center') alignX = xPos - ((bbox.x2 - bbox.x1) / 2) - bbox.x1;
                if (align === 'right') alignX = xPos - (bbox.x2 - bbox.x1) - bbox.x1;
                if (align === 'left') alignX = xPos - bbox.x1;
                
                svgContent += `<path d="${pathObj.toPathData(5)}" transform="translate(${alignX}, ${textY - bbox.y1})" fill="currentColor" />`;
            } catch(e) { console.error("Font Load Physics failed", e); }
        }

        if (hasBraille) {
            svgContent += `<g fill="rgba(180, 180, 180, 0.35)" stroke="rgba(255, 255, 255, 0.7)" stroke-width="0.008">
                ${this.generateBraillePaths(textVal, xPos, brailleY, align)}
            </g>`;
        }

        return { svgContent, warnMsgs, pictoSize: pictoSize.toFixed(2), fontSize: fontSize.toFixed(3) };
    }
};
