import React, { useRef } from 'react';
import * as THREE from 'three';
import { SignConfig, SignType } from '../../types';
import { ChannelLetterRenderer } from './ChannelLetterRenderer';
import { PartVisibility } from './utils';

// Re-export PartVisibility for App consumption
export type { PartVisibility };

interface SignRendererProps {
  config: SignConfig;
  ledIntensity: number;
  shadowIntensity: number;
  partVisibility?: PartVisibility;
  onUpdateLength?: (index: number, length: number) => void;
}

export const SignRenderer: React.FC<SignRendererProps> = ({ config, ledIntensity, shadowIntensity, partVisibility, onUpdateLength }) => {
  const meshRef = useRef<THREE.Group>(null);
  return (
    <group ref={meshRef} position={[0, 0, 0]}>
      {config.type === SignType.CHANNEL_LETTER ? (
        <ChannelLetterRenderer 
            config={config} 
            ledIntensity={ledIntensity} 
            shadowIntensity={shadowIntensity} 
            partVisibility={partVisibility}
            onUpdateLength={onUpdateLength} 
        />
      ) : (
         <mesh position={[0, 0, 4]}>
           <boxGeometry args={[48, 24, 8]} />
           <meshStandardMaterial color="#cccccc" />
         </mesh>
      )}
    </group>
  );
};