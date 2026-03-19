
import React, { useState, useEffect } from 'react';
import { Center } from '@react-three/drei';
import * as THREE from 'three';
import { SignConfig, MountType, BackerShape } from '../../types';
import { calculateRacewayTuckLength } from '../../services/vectorUtils';
import { LetterGroup } from './LetterGroup';
import { PartVisibility } from './utils';

interface SignLineProps {
    line: string;
    index: number;
    config: SignConfig;
    yPosition: number;
    fontUrl: string;
    letterHeight: number;
    widthFactor: number;
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
    racewayFaceZ: number;
    wallFaceZ: number;
    isHalo: boolean;
    isFrontLit: boolean;
    isLit: boolean;
    isRaceway: boolean;
    isBackerMount: boolean;
    backerLit: boolean;
    backerShape?: BackerShape;
    backerPadding?: number;
    racewayColor: string;
    racewayOffset: number;
    racewayH: number;
    racewayD: number;
    shadowIntensity: number;
    visibility: PartVisibility;
    onUpdateLength?: (index: number, length: number) => void;
}

export const SignLine: React.FC<SignLineProps> = ({ 
    line, index, config, yPosition, letterHeight, widthFactor, 
    racewayOffset, racewayH, racewayD, racewayColor, shadowIntensity,
    visibility,
    wallFaceZ,
    onUpdateLength,
    backerShape,
    backerPadding,
    ...props 
}) => {
    
    const [measuredWidth, setMeasuredWidth] = useState(0);
    const preciseRacewayLength = calculateRacewayTuckLength(line, letterHeight, config.fontFamily);

    useEffect(() => {
        if (config.dimensions.racewayLengthsAuto[index] && onUpdateLength) {
            if (Math.abs(config.dimensions.racewayLengths[index] - preciseRacewayLength) > 0.1) {
                onUpdateLength(index, preciseRacewayLength);
            }
        }
    }, [preciseRacewayLength, config.dimensions.racewayLengthsAuto, config.dimensions.racewayLengths, index, onUpdateLength]);

    const rwLength = config.dimensions.racewayLengthsAuto[index] 
      ? preciseRacewayLength
      : config.dimensions.racewayLengths[index];
    
    const racewayXPos = 0;
    const racewayYPos = (letterHeight * 0.5) + racewayOffset;
    const componentKey = `${line}-${config.fontFamily}-${letterHeight}`;
    const SHADOW_OFFSET_X = 0.3;
    const SHADOW_OFFSET_Y = -1.5;

    // Raceway Shadow on Wall
    const racewayShadowZ = wallFaceZ + 0.05;

    return (
        <group position={[0, yPosition, 0]}>
             <Center top disableY disableZ cacheKey={componentKey}>
                <LetterGroup 
                    line={line} 
                    letterHeight={letterHeight} 
                    visibility={visibility}
                    wallFaceZ={wallFaceZ}
                    backerShape={backerShape}
                    backerPadding={backerPadding}
                    onMeasure={(w) => {
                        if (Math.abs(w - measuredWidth) > 0.05) setMeasuredWidth(w);
                    }}
                    {...props} 
                />
             </Center>

             {config.mount === MountType.RACEWAY && (
                <>
                  {/* Raceway Box - Writes Stencil Ref 5 */}
                  <mesh 
                      position={[racewayXPos, racewayYPos, racewayD / 2]}
                      visible={visibility.raceway}
                      renderOrder={-1} 
                  > 
                      <boxGeometry args={[rwLength, racewayH, racewayD]} /> 
                      <meshStandardMaterial 
                        color={racewayColor} 
                        roughness={0.6} 
                        metalness={0.05} 
                        stencilWrite={true}
                        stencilRef={5}
                        stencilFunc={THREE.AlwaysStencilFunc}
                        stencilZPass={THREE.ReplaceStencilOp}
                      />
                  </mesh>

                  {/* Raceway Drop Shadow on Wall */}
                  <group position={[racewayXPos + SHADOW_OFFSET_X, racewayYPos + SHADOW_OFFSET_Y, racewayShadowZ]}>
                      <mesh renderOrder={-2}>
                        <planeGeometry args={[rwLength, racewayH]} />
                        <meshBasicMaterial color="#000000" transparent opacity={shadowIntensity * 0.5} depthWrite={false} />
                      </mesh>
                      <mesh position={[0,0,-0.001]} scale={[1.01, 1.1, 1]} renderOrder={-2}>
                        <planeGeometry args={[rwLength, racewayH]} />
                        <meshBasicMaterial color="#000000" transparent opacity={shadowIntensity * 0.25} depthWrite={false} />
                      </mesh>
                  </group>
                </>
              )}
        </group>
    );
};
