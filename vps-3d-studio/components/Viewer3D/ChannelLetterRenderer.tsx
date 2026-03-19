
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { SignConfig, MountType, IlluminationType, BackerShape } from '../../types';
import { FONT_LIBRARY } from '../../constants';
import { SignLine } from './SignLine';
import { useSignMaterials } from './useSignMaterials';
import { PartVisibility } from './utils';

interface ChannelLetterRendererProps {
  config: SignConfig;
  ledIntensity: number;
  shadowIntensity: number;
  partVisibility?: PartVisibility;
  onUpdateLength?: (index: number, length: number) => void;
}

export const ChannelLetterRenderer: React.FC<ChannelLetterRendererProps> = ({ config, ledIntensity, shadowIntensity, partVisibility, onUpdateLength }) => {
  
  const selectedFont = FONT_LIBRARY[config.fontFamily as keyof typeof FONT_LIBRARY] || Object.values(FONT_LIBRARY)[0];
  const fontSource = selectedFont.font; 
  const widthFactor = selectedFont.widthFactor;
  
  const isHalo = config.illumination === IlluminationType.HALO_LIT || config.illumination === IlluminationType.DUAL_LIT;
  const isFrontLit = config.illumination === IlluminationType.FRONT_LIT || config.illumination === IlluminationType.DUAL_LIT;
  const isLit = config.illumination !== IlluminationType.NON_ILLUMINATED;

  // New Logic: If lights are active and it involves Halo lighting, disable shadows to prevent visual conflict.
  const lightsOn = ledIntensity > 0.1;
  const effectiveShadowIntensity = (isHalo && lightsOn) ? 0 : shadowIntensity;

  const materials = useSignMaterials(config, ledIntensity, effectiveShadowIntensity);

  const letterHeight = config.dimensions.height;
  const rowGap = config.dimensions.lineSpacing !== undefined ? config.dimensions.lineSpacing : (letterHeight * 0.2);
  const lineHeight = letterHeight + rowGap;
  
  const depth = config.dimensions.depth;
  const trimDepth = 0.75; 
  const racewayH = 6;
  const racewayD = 4;
  const racewayOffset = config.dimensions.racewayOffset || 0;
  
  const WALL_Z = -0.5;
  const BACKER_THICK = 0.125;

  let mountZ = 0; 
  let targetSurfaceZ = WALL_Z; 
  let backerFaceZ = WALL_Z;

  if (config.mount === MountType.RACEWAY) {
      mountZ = racewayD; 
      targetSurfaceZ = racewayD; 
  } 
  else if (config.mount === MountType.BACKER) {
      const mStandoff = config.dimensions.standoff || 0;
      const lStandoff = config.dimensions.letterStandoff || 0;
      
      backerFaceZ = WALL_Z + mStandoff + BACKER_THICK;
      mountZ = backerFaceZ + lStandoff;
      targetSurfaceZ = backerFaceZ;
  } 
  else {
      const standoff = config.dimensions.standoff || 0;
      mountZ = WALL_Z + standoff;
      targetSurfaceZ = WALL_Z; 
  }

  const zOffset1 = (targetSurfaceZ - mountZ) + 0.05; 
  const zOffset2 = (WALL_Z - mountZ) + 0.05; 

  // Glow Logic - Intensity Boosted for visibility
  const baseGlowOpacity = (ledIntensity / 5) * 2.5;
  
  // Distance from Light Source (Letter Back) to Target Surface
  const distToTarget1 = Math.abs(mountZ - targetSurfaceZ);
  
  // Distance from Light Source to Wall (For secondary glow in Raceway mode)
  const distToTarget2 = Math.abs(mountZ - WALL_Z);

  const getGlowParams = (distance: number) => {
    const d = Math.max(0.1, distance);
    const spread = 1 + (d * 0.6);
    const sizes = { core: 0.05 * spread, mid: 0.25 * spread, outer: 0.8 * spread };
    const opacityFactor = 1 / (1 + (d * 0.15));
    return { sizes, opacityFactor };
  };

  // Params 1: Primary Surface (Raceway or Backer or Wall)
  const params1 = getGlowParams(distToTarget1);
  // Params 2: Wall (Used for Secondary Glow in Raceway mode)
  const params2 = getGlowParams(distToTarget2);

  const { mats1, mats2 } = useMemo(() => {
    const createGlowMats = (opacityFactor: number, useStencil: boolean = false) => {
        const stencilProps = useStencil ? {
            stencilWrite: true, 
            stencilRef: 5, // Corrected to match Raceway ID
            stencilFunc: THREE.EqualStencilFunc,
            stencilFail: THREE.KeepStencilOp, 
            stencilZFail: THREE.KeepStencilOp, 
            stencilZPass: THREE.KeepStencilOp,
        } : {};
        return {
            core: new THREE.MeshBasicMaterial({ color: materials.ledHex, transparent: true, opacity: baseGlowOpacity * opacityFactor, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false, ...stencilProps }),
            mid: new THREE.MeshBasicMaterial({ color: materials.ledHex, transparent: true, opacity: baseGlowOpacity * 0.5 * opacityFactor, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false, ...stencilProps }),
            outer: new THREE.MeshBasicMaterial({ color: materials.ledHex, transparent: true, opacity: baseGlowOpacity * 0.2 * opacityFactor, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false, ...stencilProps })
        };
    };
    return { 
        mats1: createGlowMats(params1.opacityFactor, config.mount === MountType.RACEWAY),
        mats2: createGlowMats(params2.opacityFactor, false)
    };
  }, [materials.ledHex, baseGlowOpacity, params1.opacityFactor, params2.opacityFactor, config.mount]);

  const backerZ = isHalo ? 0.1 : 0; 
  const backerThickness = config.backerThickness; 

  const activeIndices = config.lines.map((l, i) => l ? i : -1).filter(i => i !== -1);
  const minIdx = activeIndices.length > 0 ? Math.min(...activeIndices) : 0;
  const maxIdx = activeIndices.length > 0 ? Math.max(...activeIndices) : 0;
  const centerLineIndex = (minIdx + maxIdx) / 2;

  const vis = partVisibility || { faces: true, trimCapSides: true, trimCapFaces: true, returns: true, backers: true, raceway: true };
  const meshRef = useRef<THREE.Group>(null);

  // Rectangle Backer Geometry Calculation
  const isRectBacker = config.mount === MountType.BACKER && config.backerShape === BackerShape.RECTANGLE;
  
  // Requirement: Taller/Wider than letters by 12.5%
  // Scale factor = 1.125
  const SCALE_FACTOR = 1.125;
  const rectWidth = config.dimensions.calculatedWidth * SCALE_FACTOR;
  
  const numActiveLines = activeIndices.length || 1;
  const textBlockHeight = (numActiveLines * letterHeight) + ((numActiveLines - 1) * rowGap);
  const rectHeight = textBlockHeight * SCALE_FACTOR;
  
  // Vertical Centering: Text block is centered around letterHeight/2 in the Group local space
  // See: yPosition logic aligns baseline such that average center is letterHeight/2.
  const rectY = letterHeight / 2;
  
  return (
    <group ref={meshRef} position={[0, 0, 0]}>
      {/* Rectangular Backer Panel */}
      {isRectBacker && (
          <group position={[0, rectY, backerFaceZ - (BACKER_THICK/2)]} visible={vis.backers}>
              {/* Panel Body */}
              <mesh>
                  <boxGeometry args={[rectWidth, rectHeight, BACKER_THICK]} />
                  <primitive object={materials.mountingBackerMaterial} />
              </mesh>
              
              {/* Panel Shadow on Wall */}
              <mesh position={[0.2, -0.3, -((config.dimensions.standoff || 0) + 0.05)]}>
                  <planeGeometry args={[rectWidth, rectHeight]} />
                  <meshBasicMaterial color="black" transparent opacity={shadowIntensity * 0.5} />
              </mesh>
              
              {/* Halo Glow Behind Rectangle */}
              {config.backerLit && lightsOn && (
                  <group position={[0, 0, -BACKER_THICK/2 - 0.1]}>
                     <mesh>
                         <planeGeometry args={[rectWidth * 1.05, rectHeight * 1.05]} />
                         <primitive object={mats2.core} />
                     </mesh>
                     <mesh position={[0,0,-0.1]}>
                         <planeGeometry args={[rectWidth * 1.2, rectHeight * 1.2]} />
                         <primitive object={mats2.mid} />
                     </mesh>
                     <mesh position={[0,0,-0.2]}>
                         <planeGeometry args={[rectWidth * 1.5, rectHeight * 1.5]} />
                         <primitive object={mats2.outer} />
                     </mesh>
                  </group>
              )}
          </group>
      )}

      {config.lines.map((line, i) => {
        if (!line) return null;
        const yPosition = (centerLineIndex - i) * lineHeight;
        return (
          <SignLine
            key={i}
            line={line}
            index={i}
            config={config}
            yPosition={yPosition}
            fontUrl={fontSource as string} 
            letterHeight={letterHeight}
            widthFactor={widthFactor}
            depth={depth}
            faceThickness={config.faceThickness}
            trimDepth={trimDepth}
            returnMaterial={materials.returnMaterial}
            faceMaterial={materials.faceMaterial}
            trimCapMaterial={materials.trimCapMaterial}
            haloBackerMaterial={materials.haloBackerMaterial}
            mountingBackerMaterial={materials.mountingBackerMaterial}
            canMaterial={materials.canMaterial}
            invisibleMaterial={materials.invisibleMaterial}
            glowMats1={mats1}
            glowMats2={mats2}
            glowParams1={params1}
            glowParams2={params2}
            shadowMats={materials.shadowMats}
            zOffset1={zOffset1}
            zOffset2={zOffset2}
            mountZ={mountZ}
            backerZ={backerZ}
            backerThickness={backerThickness}
            racewayFaceZ={racewayD}
            wallFaceZ={WALL_Z}
            isHalo={isHalo}
            isFrontLit={isFrontLit}
            isLit={isLit}
            isRaceway={config.mount === MountType.RACEWAY}
            isBackerMount={config.mount === MountType.BACKER}
            backerLit={config.backerLit}
            backerShape={config.backerShape} // Pass new props
            backerPadding={config.backerPadding} // Pass new props
            racewayColor={config.colors.raceway.startsWith('#') ? config.colors.raceway : '#333333'} 
            racewayOffset={racewayOffset}
            racewayH={racewayH}
            racewayD={racewayD}
            shadowIntensity={effectiveShadowIntensity}
            visibility={vis}
            onUpdateLength={onUpdateLength}
          />
        );
      })}
    </group>
  );
};
