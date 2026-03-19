
import React, { useRef, useLayoutEffect } from 'react';
import { Text3D } from '@react-three/drei';
import * as THREE from 'three';
import { PartVisibility } from './utils';
import { BackerShape } from '../../types';

interface LetterGroupProps {
    line: string;
    fontUrl: string;
    letterHeight: number;
    depth: number;
    faceThickness: number;
    trimDepth: number;
    returnMaterial: THREE.Material;
    faceMaterial: THREE.Material;
    trimCapMaterial: THREE.Material;
    haloBackerMaterial: THREE.Material;
    mountingBackerMaterial: THREE.Material;
    canMaterial: THREE.Material[];
    invisibleMaterial: THREE.Material;
    glowMats1: any;
    glowMats2: any;
    glowParams1: any;
    glowParams2: any;
    shadowMats: any;
    zOffset1: number;
    zOffset2: number;
    mountZ: number; 
    backerZ: number;
    backerThickness: number;
    isHalo: boolean;
    isFrontLit: boolean;
    isLit: boolean;
    isRaceway: boolean;
    isBackerMount: boolean;
    backerLit: boolean;
    backerShape?: BackerShape;
    backerPadding?: number;
    racewayFaceZ: number;
    wallFaceZ: number;
    visibility: PartVisibility;
    onMeasure?: (width: number) => void;
}

export const LetterGroup: React.FC<LetterGroupProps> = ({ 
    line, fontUrl, letterHeight, depth, faceThickness, trimDepth, 
    returnMaterial, faceMaterial, trimCapMaterial, haloBackerMaterial, mountingBackerMaterial, canMaterial,
    invisibleMaterial,
    glowMats1, glowMats2, glowParams1, glowParams2, shadowMats,
    zOffset1, zOffset2, mountZ, backerZ, backerThickness,
    isHalo, isFrontLit, isLit, isRaceway, isBackerMount, backerLit, backerShape, backerPadding, racewayFaceZ, wallFaceZ,
    visibility,
    onMeasure
}) => {
    
    const meshRef = useRef<THREE.Mesh>(null);

    useLayoutEffect(() => {
        if (meshRef.current && onMeasure) {
            meshRef.current.geometry.computeBoundingBox();
            const box = meshRef.current.geometry.boundingBox;
            if (box) {
                const width = box.max.x - box.min.x;
                onMeasure(width);
            }
        }
    }, [line, fontUrl, letterHeight, onMeasure]);

    const faceRecess = 0.05;
    const faceZ = depth - faceThickness - faceRecess; 
    const canHeight = Math.max(0.1, depth - faceThickness - faceRecess); 
    const trimLipZ = depth; 
    const trimSideZ = depth - 0.75; 

    const trimStrokeWidth = 0.25; 
    const trimInwardSize = -trimStrokeWidth;
    const trimSideExpansion = 0.03; 

    const LOW_RES_SEGMENTS = 24;
    
    // Dynamic backer offset logic
    // Default 12.5% if not provided, otherwise use explicit backerPadding
    const backerOffset = backerPadding !== undefined ? backerPadding : (letterHeight * 0.125); 

    const backerPanelThickness = 0.125; 
    const SHADOW_X = 0.2;
    const SHADOW_Y = -0.3;
    
    // High render order for glows to ensure they draw after raceway writes stencil
    const GLOW_RENDER_ORDER = 100;
    const SHADOW_RENDER_ORDER = 90;

    // Check if we should render the CONTOUR backer here
    // If shape is RECTANGLE, we skip rendering the contour backer + its shadow/glow
    const showContourBacker = isBackerMount && (backerShape === BackerShape.CONTOUR || !backerShape);

    return (
        <group position={[0, 0, mountZ]} castShadow>
            
            {/* 0. MOUNTING BACKER PANEL (Cloud Shape) & ITS SHADOW */}
            {showContourBacker && (
                <>
                    {/* Backer Shadow on Wall */}
                    <group position={[SHADOW_X, SHADOW_Y, zOffset2]}>
                        <Text3D 
                            font={fontUrl} 
                            size={letterHeight} 
                            height={0} 
                            curveSegments={LOW_RES_SEGMENTS} 
                            bevelEnabled 
                            bevelThickness={0} 
                            bevelSize={backerOffset} 
                            material={shadowMats.wallCore} 
                            renderOrder={SHADOW_RENDER_ORDER - 10} 
                        >
                            {line}
                        </Text3D>
                        <Text3D 
                            font={fontUrl} 
                            size={letterHeight} 
                            height={0} 
                            curveSegments={LOW_RES_SEGMENTS} 
                            bevelEnabled 
                            bevelThickness={0} 
                            bevelSize={backerOffset + 0.3} 
                            material={shadowMats.wallMid} 
                            renderOrder={SHADOW_RENDER_ORDER - 10}
                        >
                            {line}
                        </Text3D>
                        <Text3D 
                            font={fontUrl} 
                            size={letterHeight} 
                            height={0} 
                            curveSegments={LOW_RES_SEGMENTS} 
                            bevelEnabled 
                            bevelThickness={0} 
                            bevelSize={backerOffset + 0.8} 
                            material={shadowMats.wallOuter} 
                            renderOrder={SHADOW_RENDER_ORDER - 10}
                        >
                            {line}
                        </Text3D>
                    </group>

                    <group position={[0, 0, -0.5]}> 
                         <Text3D
                            font={fontUrl}
                            size={letterHeight}
                            height={backerPanelThickness}
                            position={[0, 0, -0.25]}
                            curveSegments={12}
                            bevelEnabled={true}
                            bevelThickness={0} 
                            bevelSize={backerOffset} 
                            material={mountingBackerMaterial} 
                            visible={visibility.backers}
                            renderOrder={5}
                         >
                            {line}
                         </Text3D>
                         
                         {backerLit && (
                            <group position={[0, 0, zOffset2 - (-0.5)]}> 
                                <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={backerOffset + 0.5} material={glowMats2.core} renderOrder={GLOW_RENDER_ORDER}>{line}</Text3D>
                                <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={backerOffset + 2.0} material={glowMats2.mid} renderOrder={GLOW_RENDER_ORDER}>{line}</Text3D>
                                <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={backerOffset + 6.0} material={glowMats2.outer} renderOrder={GLOW_RENDER_ORDER}>{line}</Text3D>
                            </group>
                         )}
                    </group>
                </>
            )}

            {/* 1. CAST SHADOWS (Letters) */}
            {/* Primary Shadow (Clipped if Raceway, Normal if Wall or Backer) */}
            <group position={[SHADOW_X, SHADOW_Y, zOffset1]}>
               <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={0} material={isRaceway ? shadowMats.clippedCore : shadowMats.wallCore} renderOrder={SHADOW_RENDER_ORDER}>{line}</Text3D>
               <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={0.2} material={isRaceway ? shadowMats.clippedMid : shadowMats.wallMid} renderOrder={SHADOW_RENDER_ORDER}>{line}</Text3D>
               <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={0.5} material={isRaceway ? shadowMats.clippedOuter : shadowMats.wallOuter} renderOrder={SHADOW_RENDER_ORDER}>{line}</Text3D>
            </group>

            {/* Secondary Wall Shadow (Only if Raceway, to catch ascenders/descenders) */}
            {isRaceway && (
               <group position={[SHADOW_X, SHADOW_Y, zOffset2]}>
                  <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={0} material={shadowMats.wallCore} renderOrder={SHADOW_RENDER_ORDER}>{line}</Text3D>
                  <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={0.2} material={shadowMats.wallMid} renderOrder={SHADOW_RENDER_ORDER}>{line}</Text3D>
                  <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={0.5} material={shadowMats.wallOuter} renderOrder={SHADOW_RENDER_ORDER}>{line}</Text3D>
               </group>
            )}

            {/* 2. THE CAN (Returns) */}
            <Text3D
              ref={meshRef}
              font={fontUrl}
              size={letterHeight}
              height={canHeight}
              curveSegments={12}
              bevelEnabled={true}
              bevelThickness={0} 
              bevelSize={0}
              material={canMaterial}
              visible={visibility.returns}
              renderOrder={10}
            >
              {line}
            </Text3D>

            {/* 3. FACE ASSEMBLY */}
            <Text3D
                font={fontUrl}
                size={letterHeight}
                height={faceThickness}
                position={[0, 0, faceZ]} 
                curveSegments={12}
                bevelEnabled={true}
                bevelThickness={0} 
                bevelSize={isFrontLit ? -0.23 : 0} 
                material={faceMaterial} 
                visible={visibility.faces}
                renderOrder={15}
            >
                {line}
            </Text3D>

            {/* 4. TRIM CAP */}
            {isFrontLit && (
                <group>
                    <group visible={visibility.trimCapFaces}>
                        <Text3D
                            font={fontUrl}
                            size={letterHeight}
                            height={0.04} 
                            position={[0, 0, trimLipZ]}
                            curveSegments={12}
                            bevelEnabled={true}
                            bevelThickness={0.001} 
                            bevelSize={trimInwardSize}
                            material={[invisibleMaterial, trimCapMaterial]}
                            renderOrder={20}
                        >
                            {line}
                        </Text3D>
                    </group>
                    <Text3D
                        font={fontUrl}
                        size={letterHeight}
                        height={0.75} 
                        position={[0, 0, trimSideZ]} 
                        curveSegments={12}
                        bevelEnabled={true}
                        bevelThickness={0}
                        bevelSize={trimSideExpansion}
                        material={[invisibleMaterial, trimCapMaterial]}
                        visible={visibility.trimCapSides}
                        renderOrder={25}
                    >
                        {line}
                    </Text3D>
                </group>
            )}

            {/* 5. HALO LIT FACE (Rear Poly) & GLOW */}
            {isHalo && (
            <group>
                <Text3D
                  font={fontUrl}
                  size={letterHeight}
                  height={backerThickness}
                  position={[0, 0, backerZ]} 
                  curveSegments={12}
                  bevelEnabled={true} 
                  bevelThickness={0}
                  bevelSize={-0.05} 
                  material={haloBackerMaterial}
                  visible={visibility.backers}
                >
                  {line}
                </Text3D>
                
                {isLit && (
                  <>
                    {/* Primary Glow (Raceway Clipped or Wall) */}
                    <group position={[0, 0, zOffset1 + 0.01]}>
                        <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={glowParams1.sizes.core} material={glowMats1.core} renderOrder={GLOW_RENDER_ORDER}>{line}</Text3D>
                        <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={glowParams1.sizes.mid} material={glowMats1.mid} renderOrder={GLOW_RENDER_ORDER}>{line}</Text3D>
                        <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={glowParams1.sizes.outer} material={glowMats1.outer} renderOrder={GLOW_RENDER_ORDER}>{line}</Text3D>
                    </group>

                    {/* Secondary Wall Glow (If Raceway) */}
                    {isRaceway && (
                        <group position={[0, 0, zOffset2]}>
                            <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={glowParams2.sizes.core} material={glowMats2.core} renderOrder={GLOW_RENDER_ORDER}>{line}</Text3D>
                            <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={glowParams2.sizes.mid} material={glowMats2.mid} renderOrder={GLOW_RENDER_ORDER}>{line}</Text3D>
                            <Text3D font={fontUrl} size={letterHeight} height={0} curveSegments={LOW_RES_SEGMENTS} bevelEnabled bevelThickness={0} bevelSize={glowParams2.sizes.outer} material={glowMats2.outer} renderOrder={GLOW_RENDER_ORDER}>{line}</Text3D>
                        </group>
                    )}
                  </>
                )}
            </group>
            )}
        </group>
    )
}
