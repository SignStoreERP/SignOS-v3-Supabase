
import React, { useEffect } from 'react';
import { SignConfig, SignType, MountType, IlluminationType, TextAlignment, LEDColor, WallTexture, FaceMaterial, BackerMaterial, BackerShape } from '../../types';
import { 
  RETURN_COLORS, 
  TRIM_CAP_COLORS, 
  VINYL_SERIES, 
  PAINT_COLORS, 
  FONT_LIBRARY
} from '../../constants';
import { calculateTotalWidth } from '../../services/vectorUtils';
import { LayoutGrid, AlignLeft, AlignCenter, AlignRight, Sun, Lightbulb, Palette, ToggleLeft, ToggleRight, MoveVertical, ArrowRightToLine, BoxSelect, Type, Ruler, CloudSun, ArrowDownUp, Layers, ArrowLeftRight, Component } from 'lucide-react';

interface ControlsProps {
  config: SignConfig;
  onChange: (newConfig: SignConfig) => void;
  viewSettings: {
    ambientIntensity: number;
    ledIntensity: number;
    lightsActive: boolean;
    shadowIntensity: number;
  };
  onViewChange: (settings: { ambientIntensity?: number; ledIntensity?: number; lightsActive?: boolean; shadowIntensity?: number }) => void;
  onCalibrate?: () => void;
}

const ColorGridPicker = ({ 
  options, 
  selected, 
  onSelect, 
  label 
}: { 
  options: {name: string, hex: string}[], 
  selected: string, 
  onSelect: (val: string) => void,
  label: string
}) => (
  <div className="mb-4">
    <label className="block text-xs text-slate-500 mb-2">{label}: <span className="text-slate-300 font-medium">{selected}</span></label>
    <div className="grid grid-cols-5 gap-2">
      {options.map((c) => (
        <button
          key={c.name}
          onClick={() => onSelect(c.name)}
          className={`w-8 h-8 rounded border-2 transition-all relative group ${selected === c.name ? 'border-blue-500 scale-110' : 'border-slate-700 hover:border-slate-500'}`}
          style={{ backgroundColor: c.hex }}
          title={c.name}
        >
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {c.name}
          </span>
        </button>
      ))}
    </div>
  </div>
);

export const Controls: React.FC<ControlsProps> = ({ config, onChange, viewSettings, onViewChange, onCalibrate }) => {
  
  useEffect(() => {
    const w = calculateTotalWidth(config.lines, config.dimensions.height, config.fontFamily);
    if (w !== config.dimensions.calculatedWidth) {
      onChange({ ...config, dimensions: { ...config.dimensions, calculatedWidth: w } });
    }
  }, [config.lines, config.dimensions.height, config.fontFamily]);

  const update = (key: keyof SignConfig, value: any) => {
    let newConfig = { ...config, [key]: value };

    // Auto-Logic for Backer/Halo interactions
    // FIX: Must create new object references for nested properties to avoid mutation
    if (key === 'mount' && value === MountType.BACKER) {
        newConfig = {
            ...newConfig,
            backerMaterial: BackerMaterial.ACM,
            backerShape: BackerShape.CONTOUR,
            backerPadding: 2,
            dimensions: {
                ...config.dimensions,
                standoff: 2,
                letterStandoff: 0.5
            }
        };
    }
    
    if (key === 'illumination' && value === IlluminationType.HALO_LIT) {
        onViewChange({ lightsActive: true, ledIntensity: 3.75, ambientIntensity: 0.21, shadowIntensity: 0.8 });
    }

    onChange(newConfig);
  };

  const updateDim = (key: keyof typeof config.dimensions, value: any) => {
    onChange({ ...config, dimensions: { ...config.dimensions, [key]: value } });
  };

  const updateColor = (key: keyof typeof config.colors, value: string) => {
    onChange({ ...config, colors: { ...config.colors, [key]: value } });
  };

  const handleLineChange = (index: number, val: string) => {
    const newLines = [...config.lines];
    newLines[index] = val.toUpperCase();
    update('lines', newLines);
  };

  const updateRacewayLength = (index: number, val: number) => {
    const newLengths = [...config.dimensions.racewayLengths];
    newLengths[index] = val;
    updateDim('racewayLengths', newLengths);
  }

  const toggleRacewayAuto = (index: number) => {
    const newAutos = [...config.dimensions.racewayLengthsAuto];
    newAutos[index] = !newAutos[index];
    updateDim('racewayLengthsAuto', newAutos);
  }

  const currentVinylOptions = VINYL_SERIES[config.colors.vinylSeries as keyof typeof VINYL_SERIES] || [];

  return (
    <div className="space-y-6 text-sm pb-10">
      
      {/* 0. Scene & Lighting */}
      <div className="space-y-4 bg-slate-800/30 p-3 rounded-lg border border-slate-800">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">
          <Sun size={12}/> Scene & Illumination
        </h3>
        
        {/* Environment Light Slider */}
        <div className="mb-3">
             <div className="flex justify-between text-xs text-slate-400 mb-1">
               <span className="flex items-center gap-1"><CloudSun size={10}/> Environment</span>
               <span>{Math.round((viewSettings.ambientIntensity / 3) * 100)}%</span>
             </div>
             <input 
               type="range" 
               min="0" max="3" step="0.1" 
               value={viewSettings.ambientIntensity}
               onChange={(e) => onViewChange({ ambientIntensity: parseFloat(e.target.value) })}
               className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
             />
        </div>

        <div className="mb-2">
          <label className="block text-xs text-slate-500 mb-1">Light Method</label>
          <select 
            value={config.illumination} 
            onChange={(e) => update('illumination', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
          >
            {Object.values(IlluminationType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        
        {/* Backer Halo Option */}
        {config.mount === MountType.BACKER && (
            <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded border border-slate-700">
                <span className="text-xs text-slate-300">Backer Halo Lit (Wall Wash)</span>
                <button 
                  onClick={() => {
                      update('backerLit', !config.backerLit);
                      if (!config.backerLit && !viewSettings.lightsActive) {
                          onViewChange({ lightsActive: true });
                      }
                  }}
                  className={`text-xl transition-colors ${config.backerLit ? 'text-emerald-400' : 'text-slate-600'}`}
                >
                  {config.backerLit ? <ToggleRight /> : <ToggleLeft />}
                </button>
            </div>
        )}

        {/* Light Method Specific Inputs */}
        {config.mount === MountType.RACEWAY && (
           <div className="mb-2">
             <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><MoveVertical size={10}/> Raceway Vert. Offset (in)</label>
             <div className="flex items-center gap-2">
               <input 
                 type="range" min="-12" max="12" step="0.5" 
                 value={config.dimensions.racewayOffset || 0} 
                 onChange={(e) => updateDim('racewayOffset', Number(e.target.value))} 
                 className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
               />
               <span className="text-xs w-8 text-right">{config.dimensions.racewayOffset || 0}"</span>
             </div>
           </div>
        )}

        {/* Standoff Controls */}
        {config.mount === MountType.DIRECT && config.illumination === IlluminationType.HALO_LIT && (
           <div className="mb-2">
             <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><ArrowRightToLine size={10}/> Wall Standoff (in)</label>
             <input type="number" value={config.dimensions.standoff || 0} onChange={(e) => updateDim('standoff', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5" />
           </div>
        )}
        
        {config.mount === MountType.BACKER && (
           <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800">
              <div>
                  <label className="block text-[10px] text-slate-500 mb-1 flex items-center gap-1" title="Distance from Letter back to Panel">
                      <ArrowLeftRight size={10}/> Letter Standoff
                  </label>
                  <div className="flex items-center gap-1">
                      <input 
                        type="number" min="0" step="0.25"
                        value={config.dimensions.letterStandoff} 
                        onChange={(e) => updateDim('letterStandoff', Number(e.target.value))} 
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs" 
                       />
                       <span className="text-[10px] text-slate-500">in</span>
                  </div>
              </div>
              <div>
                  <label className="block text-[10px] text-slate-500 mb-1 flex items-center gap-1" title="Distance from Panel back to Wall">
                      <ArrowRightToLine size={10}/> Mount Standoff
                  </label>
                  <div className="flex items-center gap-1">
                      <input 
                        type="number" min="0" step="0.25"
                        value={config.dimensions.standoff} 
                        onChange={(e) => updateDim('standoff', Number(e.target.value))} 
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs" 
                       />
                       <span className="text-[10px] text-slate-500">in</span>
                  </div>
              </div>
           </div>
        )}

        {config.illumination !== IlluminationType.NON_ILLUMINATED && (
          <div className="space-y-3 pt-2 border-t border-slate-700/50">
             <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400 flex items-center gap-1">
                  <Lightbulb size={12}/> LED Power
                </label>
                <button 
                  onClick={() => {
                    const isTurningOn = !viewSettings.lightsActive;
                    
                    if (isTurningOn) {
                        const isFrontLit = config.illumination === IlluminationType.FRONT_LIT || config.illumination === IlluminationType.DUAL_LIT;
                        const isHaloLit = config.illumination === IlluminationType.HALO_LIT;

                        // Default dimming for lights on
                        let newAmbient = 0.3;
                        let newLed = viewSettings.ledIntensity;

                        if (isFrontLit) {
                           // 7% Environment (scale 0-3) => 0.21
                           newAmbient = 0.21;
                           // 30% Brightness (scale 0-5) => 1.5
                           newLed = 1.5;
                        } else if (isHaloLit) {
                           newAmbient = 0.21;
                           // 75% Brightness (scale 0-5) => 3.75
                           newLed = 3.75;
                        }

                        onViewChange({ 
                            lightsActive: true,
                            ambientIntensity: newAmbient,
                            ledIntensity: newLed
                        });
                    } else {
                        // Turning off - return to bright room
                        onViewChange({ 
                            lightsActive: false,
                            ambientIntensity: 1.5
                        });
                    }
                  }}
                  className={`text-xl transition-colors ${viewSettings.lightsActive ? 'text-emerald-400' : 'text-slate-600'}`}
                >
                  {viewSettings.lightsActive ? <ToggleRight /> : <ToggleLeft />}
                </button>
             </div>

             {viewSettings.lightsActive && (
               <>
                 <div className="space-y-1">
                   <div className="flex justify-between text-xs text-slate-400">
                     <span>Brightness</span>
                     <span>{Math.round((viewSettings.ledIntensity / 5) * 100)}%</span>
                   </div>
                   <input 
                     type="range" 
                     min="0.1" max="5" step="0.1" 
                     value={viewSettings.ledIntensity}
                     onChange={(e) => onViewChange({ ledIntensity: parseFloat(e.target.value) })}
                     className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                   />
                 </div>
                 <div>
                   <label className="block text-xs text-slate-500 mb-1">LED Color</label>
                   <select 
                     value={config.ledColor} 
                     onChange={(e) => update('ledColor', e.target.value)}
                     className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                   >
                     {Object.values(LEDColor).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                 </div>
               </>
             )}
          </div>
        )}
      </div>

      {/* 1. Mounting Surface */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-200 border-b border-slate-700 pb-2 flex items-center gap-2">
          <BoxSelect size={14}/> Mounting Surface
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Texture</label>
            <select 
               value={config.wallTexture} 
               onChange={(e) => update('wallTexture', e.target.value)}
               className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
             >
               {Object.values(WallTexture).map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
          {/* Only show wall color picker if no texture is selected, otherwise texture dominates */}
          {config.wallTexture === WallTexture.NONE && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={config.wallColor}
                  onChange={(e) => update('wallColor', e.target.value)}
                  className="w-8 h-8 rounded bg-transparent cursor-pointer border-none"
                />
                <span className="text-xs text-slate-400">{config.wallColor}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Layout */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-200 border-b border-slate-700 pb-2 flex items-center gap-2">
          <LayoutGrid size={14}/> Layout
        </h3>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
             <label className="block text-xs text-slate-500 mb-1">Type</label>
             <select 
               value={config.type} 
               onChange={(e) => update('type', e.target.value)}
               className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200"
             >
               {Object.values(SignType).map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Mount</label>
            <select 
               value={config.mount} 
               onChange={(e) => update('mount', e.target.value)}
               className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200"
             >
               {Object.values(MountType).map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
        </div>

        {/* Backer Shape Controls */}
        {config.mount === MountType.BACKER && (
            <div className="p-2 bg-slate-800/50 rounded border border-slate-700 space-y-2">
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Component size={10} /> Backer Shape
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <select 
                        value={config.backerShape} 
                        onChange={(e) => update('backerShape', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                    >
                        {Object.values(BackerShape).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                        <input 
                            type="number" 
                            min="0" 
                            step="0.5"
                            value={config.backerPadding}
                            onChange={(e) => update('backerPadding', Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs"
                            placeholder="Padding"
                        />
                        <span className="text-[10px] text-slate-500">offset</span>
                    </div>
                </div>
            </div>
        )}

        {/* Font Selector */}
        <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-slate-500 flex items-center gap-1"><Type size={12}/> Typography</label>
                {onCalibrate && (
                   <button 
                     onClick={onCalibrate}
                     className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-800/50"
                     title="Calibrate HxW Ratios"
                   >
                     <Ruler size={10} /> Calibrate Metrics
                   </button>
                )}
            </div>
            <select 
              value={config.fontFamily} 
              onChange={(e) => update('fontFamily', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200"
            >
              {Object.keys(FONT_LIBRARY).map(fontName => (
                <option key={fontName} value={fontName}>{FONT_LIBRARY[fontName as keyof typeof FONT_LIBRARY].name}</option>
              ))}
            </select>
        </div>

        <div className="space-y-2 mt-4">
           <div className="flex justify-between items-center">
             <label className="block text-xs text-slate-500">Text Content</label>
             <div className="flex bg-slate-800 rounded border border-slate-700">
               <button onClick={() => update('alignment', TextAlignment.LEFT)} className={`p-1 ${config.alignment === TextAlignment.LEFT ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><AlignLeft size={12}/></button>
               <button onClick={() => update('alignment', TextAlignment.CENTER)} className={`p-1 ${config.alignment === TextAlignment.CENTER ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><AlignCenter size={12}/></button>
               <button onClick={() => update('alignment', TextAlignment.RIGHT)} className={`p-1 ${config.alignment === TextAlignment.RIGHT ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><AlignRight size={12}/></button>
             </div>
           </div>
           {[0, 1, 2].map(i => (
             <input 
               key={i}
               type="text" 
               placeholder={`Line ${i + 1}`}
               value={config.lines[i] || ''}
               onChange={(e) => handleLineChange(i, e.target.value)}
               className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 text-center font-bold tracking-widest"
             />
           ))}
        </div>
      </div>

      {/* 3. Dimensions */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-200 border-b border-slate-700 pb-2">Dimensions</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Letter Height (in)</label>
            <input type="number" value={config.dimensions.height} onChange={(e) => updateDim('height', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Letter Depth (in)</label>
            <select 
              value={config.dimensions.depth} 
              onChange={(e) => updateDim('depth', Number(e.target.value))} 
              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
            >
              <option value={3}>3"</option>
              <option value={5}>5"</option>
            </select>
          </div>
        </div>
        
        {/* Row Spacing */}
        <div className="mb-2">
            <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1"><ArrowDownUp size={10}/> Row Spacing (in)</label>
            <div className="flex items-center gap-2">
               <input 
                 type="range" min="0" max="24" step="0.5" 
                 value={config.dimensions.lineSpacing !== undefined ? config.dimensions.lineSpacing : (config.dimensions.height * 0.2)} 
                 onChange={(e) => updateDim('lineSpacing', Number(e.target.value))} 
                 className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
               />
               <span className="text-xs w-8 text-right">{config.dimensions.lineSpacing !== undefined ? config.dimensions.lineSpacing : Math.round(config.dimensions.height * 0.2)}"</span>
            </div>
        </div>

        {/* Raceway Dimensions Manual Override (Per Line) */}
        {config.mount === MountType.RACEWAY && (
          <div className="mt-2 space-y-2">
            <label className="text-xs text-slate-400 flex items-center gap-1 border-b border-slate-700 pb-1"><Ruler size={12}/> Raceway Lengths</label>
            {config.lines.map((line, idx) => {
              if (!line) return null;
              return (
                <div key={idx} className="bg-slate-800/30 p-2 rounded border border-slate-800">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Line {idx + 1}</span>
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 uppercase">Auto</span>
                          <button 
                            onClick={() => toggleRacewayAuto(idx)}
                            className={`text-lg transition-colors ${config.dimensions.racewayLengthsAuto[idx] ? 'text-blue-400' : 'text-slate-600'}`}
                          >
                            {config.dimensions.racewayLengthsAuto[idx] ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                      </div>
                    </div>
                    <input 
                        type="number" 
                        disabled={config.dimensions.racewayLengthsAuto[idx]}
                        value={config.dimensions.racewayLengths[idx]} 
                        onChange={(e) => updateRacewayLength(idx, Number(e.target.value))}
                        className={`w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs ${config.dimensions.racewayLengthsAuto[idx] ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 4. Materials & Construction */}
      <div className="space-y-3">
         <h3 className="font-semibold text-slate-200 border-b border-slate-700 pb-2 flex items-center gap-2">
            <Layers size={14}/> Construction
         </h3>
         
         {/* Face Configuration */}
         <div className="grid grid-cols-2 gap-2">
            <div>
               <label className="block text-xs text-slate-500 mb-1">Face Material</label>
               <select 
                 value={config.faceMaterial} 
                 onChange={(e) => update('faceMaterial', e.target.value)}
                 className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
               >
                 {Object.values(FaceMaterial).map(t => <option key={t} value={t}>{t}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-xs text-slate-500 mb-1">Thickness</label>
               <select 
                 value={config.faceThickness} 
                 onChange={(e) => update('faceThickness', Number(e.target.value))}
                 className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
               >
                 <option value={0.1875}>3/16"</option>
                 <option value={0.25}>1/4"</option>
               </select>
            </div>
         </div>
      </div>

      {/* 5. Finishes */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-200 border-b border-slate-700 pb-2">Finishes</h3>

        {/* Vinyl */}
        <div>
           <label className="block text-xs text-slate-500 mb-1">Face Vinyl Series</label>
           <select 
             value={config.colors.vinylSeries} 
             onChange={(e) => {
                updateColor('vinylSeries', e.target.value);
                const newSeries = VINYL_SERIES[e.target.value as keyof typeof VINYL_SERIES];
                if(newSeries && newSeries.length > 0) updateColor('face', newSeries[0].name);
             }}
             className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 mb-2"
           >
             {Object.keys(VINYL_SERIES).map(k => <option key={k} value={k}>{k}</option>)}
           </select>
           
           <label className="block text-xs text-slate-500 mb-2">Vinyl Color</label>
           <div className="grid grid-cols-5 gap-2 mb-4">
             {currentVinylOptions.map((c) => (
                <button
                  key={c.name}
                  onClick={() => updateColor('face', c.name)}
                  className={`w-8 h-8 rounded-full border-2 transition-all relative group ${config.colors.face === c.name ? 'border-white scale-110' : 'border-slate-600 hover:border-slate-400'}`}
                  style={{ backgroundColor: c.hex }}
                >
                   <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">{c.name}</span>
                </button>
             ))}
           </div>
        </div>

        <ColorGridPicker 
          label="Return (Coil)" 
          options={RETURN_COLORS} 
          selected={config.colors.return} 
          onSelect={(v) => updateColor('return', v)} 
        />

        <ColorGridPicker 
          label="Trim Cap" 
          options={TRIM_CAP_COLORS} 
          selected={config.colors.trimCap} 
          onSelect={(v) => updateColor('trimCap', v)} 
        />

        {/* Backer Paint Selection */}
        {config.mount === MountType.BACKER && (
          <div className="space-y-2 border-t border-slate-800 pt-2 mt-2">
             <ColorGridPicker 
               label="Backer Panel Paint" 
               options={PAINT_COLORS} 
               selected={config.colors.backer} 
               onSelect={(v) => updateColor('backer', v)} 
             />
          </div>
        )}

        {config.mount === MountType.RACEWAY && (
          <div className="space-y-2">
            <ColorGridPicker 
              label="Raceway Paint" 
              options={PAINT_COLORS} 
              selected={config.colors.raceway} 
              onSelect={(v) => updateColor('raceway', v)} 
            />
          </div>
        )}

      </div>
    </div>
  );
};
