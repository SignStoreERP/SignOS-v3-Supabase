
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Printer, Box, FileText, Maximize, Camera, Play, Pause, Lock, Unlock, Info, Layers, Eye, EyeOff, Gauge, DollarSign, Save } from 'lucide-react';
import * as THREE from 'three';

import { SignConfig, ManufacturingPacket, SiteSurveyData, WallTexture } from './types';
import { DEFAULT_CONFIG, SAMPLE_SURVEY } from './constants';
import { calculateSignRequirements } from './services/engine';
import { generateTexture } from './services/textureUtils';
import { PricingQuote } from './services/pricing';

import { Controls } from './components/Configurator/Controls';
import { SignRenderer, PartVisibility } from './components/Viewer3D/SignRenderer';
import { ManufacturingView } from './components/Dashboard/ManufacturingView';
import { BlueprintView } from './components/Viewer2D/BlueprintView';
import { QuoteView } from './components/Dashboard/QuoteView';
import { PricingOverlay } from './components/Dashboard/PricingOverlay';
import { FontCalibratorModal } from './components/Tools/FontCalibratorModal';

// Helper component to handle camera movements
const CameraController = ({ 
  triggerFit, 
  onFitComplete, 
  signWidth, 
  signHeight 
}: { 
  triggerFit: number, 
  onFitComplete: () => void, 
  signWidth: number, 
  signHeight: number 
}) => {
  const { camera, controls } = useThree((state) => ({ camera: state.camera, controls: state.controls }));
  
  useEffect(() => {
    if (triggerFit > 0) {
      const fov = 45 * (Math.PI / 180);
      const padding = 1.5; 
      
      const distH = (signHeight / 2) / Math.tan(fov / 2);
      const distW = (signWidth / 2) / Math.tan(fov / 2) / (window.innerWidth / window.innerHeight); 
      
      const targetZ = Math.max(distH, distW, 48) * padding;
      
      const startPos = camera.position.clone();
      const endPos = new THREE.Vector3(0, 0, targetZ);
      
      camera.position.copy(endPos);
      camera.lookAt(0,0,0);
      
      if (controls) {
        // @ts-ignore
        controls.target.set(0, 0, 0);
        // @ts-ignore
        controls.update();
      }
      
      onFitComplete();
    }
  }, [triggerFit, camera, controls, signWidth, signHeight, onFitComplete]);

  return null;
};

// Advanced Screensaver Animation Controller
const CinematicController = ({ 
    active, 
    speed,
    signWidth, 
    signHeight 
}: { 
    active: boolean, 
    speed: number,
    signWidth: number, 
    signHeight: number 
}) => {
    const { camera, controls } = useThree((state) => ({ camera: state.camera, controls: state.controls }));
    const stageRef = useRef(0);
    const timeRef = useRef(0);
    
    useFrame((state, delta) => {
        if (!active) return;
        
        const d = delta * speed * 0.4;
        timeRef.current += d;
        const t = timeRef.current;
        const w = signWidth;
        const h = signHeight;
        
        if (controls) {
             // @ts-ignore
            controls.enabled = false;
        }

        if (t < 8) {
            const pct = t / 8;
            const angle = Math.PI * 0.2 * pct;
            const z = 120 - (40 * pct);
            camera.position.x = Math.sin(angle) * z;
            camera.position.z = Math.cos(angle) * z;
            camera.position.y = 0;
            camera.lookAt(0,0,0);
        }
        else if (t < 20) {
            const pct = (t - 8) / 12; 
            const x = (w * 0.6) - ((w * 1.2) * pct); 
            camera.position.x = x;
            camera.position.z = 40; 
            camera.position.y = 0;
            camera.lookAt(x - 10, 0, 0); 
        }
        else if (t < 26) {
            const pct = (t - 20) / 6;
            const startX = -w * 0.6;
            const endX = -w * 0.8;
            camera.position.x = THREE.MathUtils.lerp(startX, endX, pct);
            camera.position.y = THREE.MathUtils.lerp(0, -h * 1.5, pct); 
            camera.position.z = THREE.MathUtils.lerp(40, 60, pct); 
            camera.lookAt(0, 0, 0); 
        }
        else if (t < 36) {
            const pct = (t - 26) / 10;
            const x = (-w * 0.8) + ((w * 1.6) * pct);
            camera.position.x = x;
            camera.position.y = -h * 1.5;
            camera.position.z = 60;
            camera.lookAt(x, 0, 0);
        }
        else if (t < 40) {
            const pct = (t - 36) / 4;
            const currentX = (w * 0.8);
            camera.position.x = THREE.MathUtils.lerp(currentX, 0, pct);
            camera.position.y = THREE.MathUtils.lerp(-h * 1.5, 0, pct);
            camera.position.z = THREE.MathUtils.lerp(60, 120, pct);
            camera.lookAt(0,0,0);
        }
        else {
            timeRef.current = 0;
        }
    });

    useEffect(() => {
        if (!active && controls) {
            // @ts-ignore
            controls.enabled = true;
        }
    }, [active, controls]);

    return null;
};

// Helper component to handle screenshots
const ScreenshotManager = ({ trigger }: { trigger: number }) => {
  const { gl, scene, camera } = useThree((state) => ({ gl: state.gl, scene: state.scene, camera: state.camera }));
  useEffect(() => {
    if (trigger > 0) {
      gl.render(scene, camera);
      const dataURL = gl.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.setAttribute('download', `sign-design-${timestamp}.png`);
      link.setAttribute('href', dataURL);
      link.click();
    }
  }, [trigger, gl, scene, camera]);

  return null;
};

// Stats Reporter - Runs inside Canvas, updates a Mutable Ref shared with App
const StatsReporter = ({ statsRef, active }: { statsRef: React.MutableRefObject<any>, active: boolean }) => {
  const { gl, camera } = useThree((state) => ({ gl: state.gl, camera: state.camera }));
  useFrame(() => {
    if (!active || !statsRef) return;
    statsRef.current = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
      camPos: camera.position.clone()
    };
  });
  return null;
};

// Debug Overlay UI - Runs outside Canvas, reads from Mutable Ref
const DebugOverlayUI = ({ active, statsRef }: { active: boolean, statsRef: React.MutableRefObject<any> }) => {
  const ref = useRef<HTMLPreElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!active) return;
    const loop = () => {
      if (ref.current && statsRef.current) {
        const s = statsRef.current;
        const camPos = s.camPos || new THREE.Vector3();
        const dist = camPos.distanceTo(new THREE.Vector3(0,0,0));
        const zoomPct = Math.round((120 / Math.max(dist, 1)) * 100);

        ref.current.textContent = `CAM : ${camPos.x.toFixed(1)}, ${camPos.y.toFixed(1)}, ${camPos.z.toFixed(1)}
DIST: ${dist.toFixed(1)}u
ZOOM: ${zoomPct}%
DRAW: ${s.calls} calls
TRIS: ${s.triangles}
TEX : ${s.textures}
GEO : ${s.geometries}`;
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [active, statsRef]);

  if (!active) return null;

  return (
    <div className="absolute bottom-6 left-6 p-4 bg-slate-950/90 border border-slate-800 rounded-lg shadow-2xl backdrop-blur-md min-w-[160px] pointer-events-none z-50">
       <h4 className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest border-b border-slate-800 pb-1">
         <Info size={12} className="text-emerald-500"/> Viewport Stats
       </h4>
       <pre ref={ref} className="font-mono text-[11px] text-emerald-400 leading-relaxed whitespace-pre"></pre>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'design' | 'blueprint' | 'fabrication' | 'quote'>('design');
  const [config, setConfig] = useState<SignConfig>(DEFAULT_CONFIG);
  const [survey] = useState<SiteSurveyData>(SAMPLE_SURVEY);
  
  // View State
  const [ambientIntensity, setAmbientIntensity] = useState(1.5); // Default 50% (Range 0-3)
  const [ledIntensity, setLedIntensity] = useState(3.0); 
  const [lightsActive, setLightsActive] = useState(false); // Default OFF
  const [shadowIntensity, setShadowIntensity] = useState(0.9); // Default 90% for Front Lit Off
  
  // Camera & Animation Control State
  const [fitTrigger, setFitTrigger] = useState(0);
  const [isCinematic, setIsCinematic] = useState(false);
  const [cinematicSpeed, setCinematicSpeed] = useState(0.5);
  const [screenshotTrigger, setScreenshotTrigger] = useState(0);
  const [cameraLocked, setCameraLocked] = useState(true); // Lock rotation to front by default
  const [showDebug, setShowDebug] = useState(false);
  
  // Tools
  const [showCalibrator, setShowCalibrator] = useState(false);

  // SignOS Token & Processing
  const [receivedSignOsToken, setReceivedSignOsToken] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<PricingQuote | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Listen for SIGNOS_AUTH_TOKEN from parent iframe
      if (event.data && event.data.type === 'SIGNOS_AUTH_TOKEN') {
        setReceivedSignOsToken(event.data.token);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleProcessCartridge = async () => {
    setIsCalculating(true);
    try {
      const response = await fetch('http://localhost:8080/api/process-cartridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${receivedSignOsToken}`
        },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();
      console.log("Success! Server calculated:", result);
      setQuoteData(result.data);
      alert("Cartridge processed successfully! Check console for details.");
    } catch (error) {
      console.error("Failed to process cartridge:", error);
      alert("Failed to process cartridge. See console for details.");
    } finally {
      setIsCalculating(false);
    }
  };

  // Mutable Ref for Stats (Performance Optimization)
  const statsRef = useRef<any>(null);

  // Debug Visibility State
  const [partVisibility, setPartVisibility] = useState<PartVisibility>({
    faces: true,
    trimCapSides: true,
    trimCapFaces: true,
    returns: true,
    backers: true,
    raceway: true
  });

  // Wall Textures State
  const [wallTextures, setWallTextures] = useState<{map: THREE.Texture | null, normalMap: THREE.Texture | null}>({ map: null, normalMap: null });

  // Auto-fit when entering design view
  useEffect(() => {
    if (activeTab === 'design') {
      const timer = setTimeout(() => {
        setFitTrigger(prev => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // Regenerate textures when wall config changes
  useEffect(() => {
    const tex = generateTexture(config.wallTexture, config.wallColor);
    setWallTextures(tex);
  }, [config.wallTexture, config.wallColor]);

  // Callback to sync measured raceway length from 3D view back to Config state
  const handleRacewayLengthUpdate = useCallback((index: number, length: number) => {
    setConfig(prev => {
        const currentLen = prev.dimensions.racewayLengths[index];
        const isAuto = prev.dimensions.racewayLengthsAuto[index];
        if (!isAuto) return prev;
        if (Math.abs(currentLen - length) < 0.1) return prev;
        
        const newLengths = [...prev.dimensions.racewayLengths];
        newLengths[index] = Math.round(length * 100) / 100; 
        
        return {
          ...prev,
          dimensions: { ...prev.dimensions, racewayLengths: newLengths }
        };
    });
  }, []);

  const togglePart = (part: keyof PartVisibility) => {
    setPartVisibility(prev => ({ ...prev, [part]: !prev[part] }));
  };

  // Memoize engineering calculations
  const manufacturingPacket: ManufacturingPacket = useMemo(() => {
    return calculateSignRequirements(config);
  }, [config]);

  // Callback stub for fit to prevent re-renders
  const handleFitComplete = useCallback(() => {}, []);

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden relative">
      
      {/* Tool Modals */}
      {showCalibrator && (
         <FontCalibratorModal 
           fontName={config.fontFamily} 
           onClose={() => setShowCalibrator(false)} 
         />
      )}

      {/* LEFT SIDEBAR - Configuration */}
      <aside className="w-96 flex flex-col border-r border-slate-800 bg-slate-900 z-20 shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg">SF</div>
          <div>
             <span className="font-bold text-lg tracking-tight block">SignFabricator OS</span>
             <span className="text-xs text-slate-500 uppercase tracking-widest">Enterprise Edition</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <Controls 
            config={config} 
            onChange={setConfig} 
            viewSettings={{ ambientIntensity, ledIntensity, lightsActive, shadowIntensity }}
            onViewChange={(s) => {
              if(s.ambientIntensity !== undefined) setAmbientIntensity(s.ambientIntensity);
              if(s.ledIntensity !== undefined) setLedIntensity(s.ledIntensity);
              if(s.lightsActive !== undefined) setLightsActive(s.lightsActive);
              if(s.shadowIntensity !== undefined) setShadowIntensity(s.shadowIntensity);
            }}
            onCalibrate={() => setShowCalibrator(true)}
          />
        </div>

        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-600 text-center">
          © 2025 SignFabricator Inc. | v3.1.0 Stable
        </div>
      </aside>

      {/* CENTER - Viewport Area */}
      <main className="flex-1 relative flex flex-col">
        
        {/* Top Navigation */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex gap-2 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700/50 shadow-2xl">
          <button 
            onClick={() => setActiveTab('design')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'design' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Box size={16} /> 3D Model
          </button>
          <button 
            onClick={() => setActiveTab('blueprint')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'blueprint' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <FileText size={16} /> Blueprint
          </button>
          <button 
             onClick={() => setActiveTab('quote')}
             className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'quote' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <DollarSign size={16} /> Quote
          </button>
          <button 
             onClick={() => setActiveTab('fabrication')}
             className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'fabrication' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Printer size={16} /> Engineering
          </button>
          <button 
             onClick={handleProcessCartridge}
             className="px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 bg-purple-600 text-white shadow-lg shadow-purple-900/50 hover:bg-purple-500"
          >
            <Save size={16} /> Process Cartridge
          </button>
        </div>

        {/* Viewport Content */}
        <div className="flex-1 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 relative overflow-hidden">
          
          {activeTab === 'design' && (
            <>
              {/* Debug Tools Panel (Floating) */}
              {showDebug && (
                  <div className="absolute left-6 top-6 z-40 w-64 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-3 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <Layers size={14} className="text-blue-500" /> Debug Layers
                          </h4>
                          <button onClick={() => setShowDebug(false)} className="text-slate-500 hover:text-white">
                             <EyeOff size={14} />
                          </button>
                      </div>
                      <div className="p-2 space-y-1">
                          {Object.entries(partVisibility).map(([key, val]) => (
                              <button 
                                key={key}
                                onClick={() => togglePart(key as keyof PartVisibility)}
                                className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors ${val ? 'bg-blue-900/30 text-blue-200 hover:bg-blue-900/50' : 'bg-slate-900/30 text-slate-600 hover:bg-slate-900/50'}`}
                              >
                                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                  {val ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                          ))}
                      </div>
                  </div>
              )}

              {/* Debug Overlay (Fixed Position UI) */}
              <DebugOverlayUI active={showDebug} statsRef={statsRef} />

              {/* Pricing Overlay (Live Estimate) */}
              <PricingOverlay config={config} onViewDetails={() => setActiveTab('quote')} quoteData={quoteData} isCalculating={isCalculating} />

              {/* 3D View Controls Toolbar */}
              <div className="absolute top-6 right-6 z-30 flex items-center gap-2">
                
                {isCinematic && (
                   <div className="mr-2 px-3 py-2 bg-slate-900/80 backdrop-blur rounded-lg border border-slate-700 flex items-center gap-2 animate-in slide-in-from-right-4 fade-in duration-300">
                      <Gauge size={14} className="text-indigo-400" />
                      <input 
                        type="range" 
                        min="0.1" 
                        max="2.0" 
                        step="0.1"
                        value={cinematicSpeed}
                        onChange={(e) => setCinematicSpeed(parseFloat(e.target.value))}
                        className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400 w-6 text-right">{cinematicSpeed}x</span>
                   </div>
                )}

                <button 
                   onClick={() => setCameraLocked(!cameraLocked)}
                   className={`p-2 rounded-lg border shadow-lg backdrop-blur transition-all ${cameraLocked ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800/80 text-white border-slate-600 hover:bg-slate-700'}`}
                   title={cameraLocked ? "Unlock Camera Rotation" : "Restrict Camera to Front"}
                >
                   {cameraLocked ? <Lock size={20} /> : <Unlock size={20} />}
                </button>
                <div className="w-px bg-slate-600 mx-1 opacity-50 h-6"></div>
                <button 
                  onClick={() => setIsCinematic(!isCinematic)}
                  className={`p-2 rounded-lg border shadow-lg backdrop-blur transition-all ${isCinematic ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800/80 text-white border-slate-600 hover:bg-slate-700'}`}
                  title={isCinematic ? "Stop Animation" : "Start Cinematic Preview"}
                >
                  {isCinematic ? <Pause size={20} /> : <Play size={20} />}
                </button>
                
                <button 
                  onClick={() => setShowDebug(!showDebug)}
                  className={`p-2 rounded-lg border shadow-lg backdrop-blur transition-all ${showDebug ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-white border-slate-600 hover:bg-slate-700'}`}
                  title="Toggle Debug Tools"
                >
                  {showDebug ? <Layers size={20} /> : <Info size={20} />}
                </button>

                <button 
                  onClick={() => setScreenshotTrigger(prev => prev + 1)}
                  className="bg-slate-800/80 hover:bg-slate-700 text-white p-2 rounded-lg border border-slate-600 shadow-lg backdrop-blur"
                  title="Take Screenshot"
                >
                  <Camera size={20} />
                </button>
                <button 
                  onClick={() => setFitTrigger(prev => prev + 1)}
                  className="bg-slate-800/80 hover:bg-slate-700 text-white p-2 rounded-lg border border-slate-600 shadow-lg backdrop-blur"
                  title="Fit Sign to View"
                >
                  <Maximize size={20} />
                </button>
              </div>

              <Canvas 
                shadows 
                dpr={[1, 2]} 
                camera={{ position: [0, 0, 120], fov: 45 }}
                gl={{ preserveDrawingBuffer: true, stencil: true }} 
              >
                <color attach="background" args={['#0f172a']} />
                
                <StatsReporter active={showDebug} statsRef={statsRef} />

                <CameraController 
                  triggerFit={fitTrigger} 
                  onFitComplete={handleFitComplete} 
                  signWidth={Math.max(config.dimensions.calculatedWidth, 48)} 
                  signHeight={config.dimensions.height * config.lines.length}
                />
                
                <CinematicController 
                   active={isCinematic} 
                   speed={cinematicSpeed}
                   signWidth={Math.max(config.dimensions.calculatedWidth, 60)} 
                   signHeight={config.dimensions.height * config.lines.length} 
                />

                <ScreenshotManager trigger={screenshotTrigger} />

                {/* Environment & Ambient Light */}
                <Environment 
                  preset="city" 
                  background 
                  blur={0.6}
                  environmentIntensity={ambientIntensity} 
                />
                <ambientLight intensity={0.3 * ambientIntensity} />

                {/* Directional Light for Shine (No Shadows) */}
                <directionalLight 
                  position={[20, 50, 50]} 
                  intensity={1.5 * ambientIntensity} 
                  castShadow={false} 
                />

                {/* THE WALL (Z = 0) */}
                <mesh position={[0, 0, -0.5]} receiveShadow={false}>
                   <planeGeometry args={[1200, 600]} />
                   <meshStandardMaterial 
                     color={config.wallTexture === WallTexture.NONE ? config.wallColor : '#ffffff'} 
                     map={wallTextures.map}
                     normalMap={wallTextures.normalMap}
                     roughness={0.8} 
                     metalness={0.0}
                   />
                </mesh>

                {/* SIGN GEOMETRY */}
                <SignRenderer 
                   config={config} 
                   ledIntensity={lightsActive ? ledIntensity : 0} 
                   shadowIntensity={shadowIntensity}
                   partVisibility={partVisibility}
                   onUpdateLength={handleRacewayLengthUpdate}
                />
                
                {/* Camera Controls */}
                <OrbitControls 
                  makeDefault
                  target={[0, 0, 0]}
                  minPolarAngle={0} 
                  maxPolarAngle={Math.PI}
                  minAzimuthAngle={cameraLocked ? -Math.PI / 2 : -Infinity}
                  maxAzimuthAngle={cameraLocked ? Math.PI / 2 : Infinity}
                  minDistance={20}
                  maxDistance={1200}
                  enableRotate={!isCinematic} 
                />

                <EffectComposer enableNormalPass={false} stencilBuffer={true}>
                  <Bloom luminanceThreshold={1.0} mipmapBlur intensity={lightsActive ? 0.8 : 0} radius={0.6} levels={9} />
                </EffectComposer>
              </Canvas>
            </>
          )}

          {activeTab === 'blueprint' && (
             <div className="w-full h-full bg-slate-200">
                <BlueprintView config={config} />
             </div>
          )}

          {activeTab === 'quote' && (
             <div className="w-full h-full bg-slate-200">
                <QuoteView config={config} quoteData={quoteData} isCalculating={isCalculating} />
             </div>
          )}

          {activeTab === 'fabrication' && (
            <div className="w-full h-full p-8 pt-24 overflow-hidden">
               <div className="max-w-6xl mx-auto h-full flex flex-col gap-6">
                 
                 {/* Header Stats */}
                 <div className="flex items-center justify-between">
                   <div>
                      <h1 className="text-3xl font-bold text-white tracking-tight">Production Order #{manufacturingPacket.id.replace('WO-', '')}</h1>
                      <p className="text-slate-400 mt-1">Status: <span className="text-yellow-500 font-medium">Pre-Production Analysis</span></p>
                   </div>
                   <div className="flex gap-4">
                     <div className="bg-slate-800/50 border border-slate-700 px-6 py-3 rounded-lg flex flex-col items-center justify-center">
                       <span className="text-2xl font-bold text-white leading-none">{manufacturingPacket.tasks.length}</span>
                       <span className="text-xs text-slate-500 uppercase mt-1">Tasks</span>
                     </div>
                     <div className="bg-slate-800/50 border border-slate-700 px-6 py-3 rounded-lg flex flex-col items-center justify-center">
                       <span className="text-2xl font-bold text-white leading-none">{manufacturingPacket.bom.length}</span>
                       <span className="text-xs text-slate-500 uppercase mt-1">SKUs</span>
                     </div>
                   </div>
                 </div>

                 {/* Main Content */}
                 <div className="flex-1 min-h-0 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                   <ManufacturingView packet={manufacturingPacket} survey={survey} />
                 </div>

               </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}