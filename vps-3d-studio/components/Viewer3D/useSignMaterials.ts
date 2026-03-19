
import { useMemo } from 'react';
import * as THREE from 'three';
import { SignConfig, IlluminationType, MountType } from '../../types';
import { RETURN_COLORS, TRIM_CAP_COLORS, PAINT_COLORS } from '../../constants';
import { getHex, getVinylHex, getMaterialProps, LED_HEX_MAP } from './utils';

export const useSignMaterials = (config: SignConfig, ledIntensity: number, shadowIntensity: number) => {
    return useMemo(() => {
        const isHalo = config.illumination === IlluminationType.HALO_LIT || config.illumination === IlluminationType.DUAL_LIT;
        const isFrontLit = config.illumination === IlluminationType.FRONT_LIT || config.illumination === IlluminationType.DUAL_LIT;
        
        const faceColorHex = getVinylHex(config.colors.vinylSeries, config.colors.face);
        const returnColorHex = getHex(config.colors.return, RETURN_COLORS);
        const trimCapColorHex = getHex(config.colors.trimCap, TRIM_CAP_COLORS);
        const ledHex = LED_HEX_MAP[config.ledColor] || '#FFFFFF';
        
        // Lookup Backer Paint Color
        const backerPaintObj = PAINT_COLORS.find(c => c.name === config.colors.backer);
        const backerColorHex = backerPaintObj ? backerPaintObj.hex : '#ffffff';

        const faceColorThree = new THREE.Color(faceColorHex);
        const ledColorThree = new THREE.Color(ledHex);
  
        // BLACK VINYL LOGIC
        const isBlackVinyl = config.colors.face.includes('Black');
        
        let finalEmissiveColor: THREE.Color;
        let boostFactor = 1.0;
  
        if (isBlackVinyl) {
            finalEmissiveColor = ledColorThree.clone();
        } else {
            const maxComponent = Math.max(faceColorThree.r, faceColorThree.g, faceColorThree.b);
            const normalizedBase = faceColorThree.clone();
            if (maxComponent > 0.01) {
                normalizedBase.multiplyScalar(1 / maxComponent);
            }
            finalEmissiveColor = normalizedBase.clone().multiply(ledColorThree);
            const luminance = 0.2126 * finalEmissiveColor.r + 0.7152 * finalEmissiveColor.g + 0.0722 * finalEmissiveColor.b;
            boostFactor = 1.0 + ((1.0 - Math.min(1.0, Math.sqrt(luminance))) * 3.5);
        }
        
        let finalIntensity = 0;
        if (isFrontLit) {
            if (isBlackVinyl) {
                finalIntensity = ledIntensity * 0.01;
            } else {
                finalIntensity = ledIntensity * 1.5 * boostFactor;
            }
        }
  
        const returnMatProps = getMaterialProps(config.colors.return);
        
        const returnMaterial = new THREE.MeshStandardMaterial({
          color: returnColorHex,
          roughness: returnMatProps.roughness,
          metalness: returnMatProps.metalness, 
        });
  
        const invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });
        const canMaterial = [invisibleMaterial, returnMaterial];
  
        let faceMaterial: THREE.MeshStandardMaterial;
        
        if (!isFrontLit) {
            // Halo Only or Non-Lit
            faceMaterial = new THREE.MeshStandardMaterial({
              color: isHalo ? returnColorHex : faceColorHex, 
              roughness: returnMatProps.roughness,
              metalness: returnMatProps.metalness,
            });
        } else {
            // Front Lit or Dual Lit
            faceMaterial = new THREE.MeshStandardMaterial({
              color: faceColorHex,
              roughness: 0.1, 
              metalness: 0.0,
              envMapIntensity: 1.5,
              emissive: finalEmissiveColor,
              emissiveIntensity: finalIntensity,
              toneMapped: false, 
              transparent: false,
              opacity: 1.0, 
            });
        }
  
        const trimCapMaterial = new THREE.MeshStandardMaterial({
          color: trimCapColorHex,
          roughness: 0.5,
          metalness: 0.1,
        });
  
        const haloBackerMaterial = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          emissive: ledHex,
          emissiveIntensity: ledIntensity * 3,
          toneMapped: false, 
          roughness: 0.2,
          metalness: 0.0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9
        });

        const mountingBackerMaterial = new THREE.MeshStandardMaterial({
            color: backerColorHex,
            roughness: 0.6,
            metalness: 0.1,
        });
  
        // Shadow Materials
        const wallShadowBase = { color: '#000000', transparent: true, side: THREE.FrontSide, depthWrite: false };
        
        // Clipped (Raceway) Materials - Uses Stencil Ref 5
        const clippedBase = { 
            stencilWrite: true,
            stencilRef: 5,
            stencilFunc: THREE.EqualStencilFunc,
            stencilFail: THREE.KeepStencilOp, 
            stencilZFail: THREE.KeepStencilOp, 
            stencilZPass: THREE.KeepStencilOp,
        };
        
        const clippedShadowBase = { 
            ...wallShadowBase,
            ...clippedBase
        };

        const shadowMats = {
          raceway: new THREE.MeshBasicMaterial({ ...wallShadowBase, opacity: shadowIntensity }),
          
          wallCore: new THREE.MeshBasicMaterial({ ...wallShadowBase, opacity: shadowIntensity * 0.6 }),
          wallMid: new THREE.MeshBasicMaterial({ ...wallShadowBase, opacity: shadowIntensity * 0.3 }),
          wallOuter: new THREE.MeshBasicMaterial({ ...wallShadowBase, opacity: shadowIntensity * 0.2 }),
          
          clippedCore: new THREE.MeshBasicMaterial({ ...clippedShadowBase, opacity: shadowIntensity * 0.6 }),
          clippedMid: new THREE.MeshBasicMaterial({ ...clippedShadowBase, opacity: shadowIntensity * 0.3 }),
          clippedOuter: new THREE.MeshBasicMaterial({ ...clippedShadowBase, opacity: shadowIntensity * 0.2 }),
        };

        const baseGlowOpacity = (ledIntensity / 5) * 2.5;
  
        // Glow Mats Helper
        const createGlowMats = (opacityFactor: number, useStencil: boolean = false) => {
            const stencilProps = useStencil ? clippedBase : {};
            
            return {
                core: new THREE.MeshBasicMaterial({ color: ledHex, transparent: true, opacity: baseGlowOpacity * opacityFactor, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false, ...stencilProps }),
                mid: new THREE.MeshBasicMaterial({ color: ledHex, transparent: true, opacity: baseGlowOpacity * 0.5 * opacityFactor, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false, ...stencilProps }),
                outer: new THREE.MeshBasicMaterial({ color: ledHex, transparent: true, opacity: baseGlowOpacity * 0.2 * opacityFactor, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false, ...stencilProps })
            };
        };
        
        const mats = {
            mats1: createGlowMats(1.0, config.mount === MountType.RACEWAY), // Mats1 is Primary (can be clipped)
            mats2: createGlowMats(1.0, false) // Mats2 is always Wall (never clipped)
        };
  
        return { 
            faceMaterial, returnMaterial, canMaterial, 
            trimCapMaterial, invisibleMaterial,
            haloBackerMaterial, mountingBackerMaterial, 
            shadowMats, ledHex,
            ...mats
        };
  
    }, [config.colors, config.ledColor, config.illumination, ledIntensity, shadowIntensity, config.mount]); // Added config.mount dependency
};
