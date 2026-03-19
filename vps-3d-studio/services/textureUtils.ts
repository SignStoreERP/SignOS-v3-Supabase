import * as THREE from 'three';

// Utility to generate procedural textures on the fly using Canvas
// This avoids external asset dependencies and CORS issues

export const generateTexture = (type: string, colorHex: string): { map: THREE.CanvasTexture | null, normalMap: THREE.CanvasTexture | null } => {
  if (type === 'Smooth / Drywall' || type === 'None') return { map: null, normalMap: null };

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { map: null, normalMap: null };

  // Base Color
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, size, size);

  // Normal Canvas (for bump map)
  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d');
  if (nCtx) {
    nCtx.fillStyle = '#8080ff'; // Flat normal default
    nCtx.fillRect(0, 0, size, size);
  }

  if (type === 'Brick') {
    const brickW = 64;
    const brickH = 32;
    
    // Draw Pattern with Higher Contrast
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; // Darker Grout
    if (nCtx) nCtx.fillStyle = '#4040ff'; // Stronger normal for grout

    for (let y = 0; y < size; y += brickH) {
      const offset = (y / brickH) % 2 === 0 ? 0 : brickW / 2;
      for (let x = -brickW; x < size; x += brickW) {
        // Draw Brick Rect
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; // Stronger highlight
        ctx.fillRect(x + offset + 2, y + 2, brickW - 4, brickH - 4);
        
        // Grout Lines
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + offset, y, brickW, brickH);
      }
    }
    
    // Add Noise
    addNoise(ctx, size, 0.3); // Increased noise
  }

  if (type === 'Stucco') {
    // High frequency noise for stucco
    addNoise(ctx, size, 0.4); 
    
    // Create Normal noise
    if (nCtx) {
        for(let i=0; i<8000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = Math.random() * 3;
            nCtx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000'; // High/Low
            nCtx.beginPath();
            nCtx.arc(x, y, r, 0, Math.PI*2);
            nCtx.fill();
        }
    }
  }

  if (type === 'Wood Siding') {
    // Horizontal planks
    const plankH = 40;
    for (let y = 0; y < size; y += plankH) {
        // Plank variation
        ctx.fillStyle = `rgba(0,0,0,${0.2 + Math.random() * 0.2})`;
        ctx.fillRect(0, y, size, plankH - 2);
        
        // Deep Line separation
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, y + plankH - 2, size, 2);
    }
    addNoise(ctx, size, 0.15);
  }

  if (type === 'Corrugated Metal') {
    // Vertical wavy lines
    const waveFreq = 0.15; // frequency
    
    // Base metal darkness
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0,0,size,size);

    for (let x = 0; x < size; x++) {
      const val = Math.sin(x * waveFreq);
      
      // Diffuse Map: Highlights on peaks, shadows in troughs
      const brightness = Math.floor((val + 1) * 30); // 0-60 variation
      ctx.fillStyle = `rgba(255,255,255, ${brightness/255})`;
      ctx.fillRect(x, 0, 1, size);

      // Normal Map: Generate slope vectors
      if (nCtx) {
        // Derivative of sin is cos
        const slope = Math.cos(x * waveFreq);
        // Map slope to 0-255. Slope ranges -1 to 1.
        // R channel = X slope. 128 is flat.
        const r = Math.floor((slope + 1) * 127);
        nCtx.fillStyle = `rgb(${r}, 128, 255)`;
        nCtx.fillRect(x, 0, 1, size);
      }
    }
    addNoise(ctx, size, 0.1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12); // Tile it

  const normalTexture = nCtx ? new THREE.CanvasTexture(nCanvas) : null;
  if (normalTexture) {
      normalTexture.wrapS = THREE.RepeatWrapping;
      normalTexture.wrapT = THREE.RepeatWrapping;
      normalTexture.repeat.set(12, 12);
  }

  return { map: texture, normalMap: normalTexture };
};

function addNoise(ctx: CanvasRenderingContext2D, size: number, intensity: number) {
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
       const val = (Math.random() - 0.5) * intensity * 255;
       data[i] += val;
       data[i+1] += val;
       data[i+2] += val;
    }
    ctx.putImageData(imageData, 0, 0);
}