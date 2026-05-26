import * as THREE from 'three';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { ResolvedMaterial } from '../types/scene';

export interface MaterialParams {
    mode?: 'toon' | 'pbr';
    normalScale?: number;
    emissionIntensity?: number;
    metallic?: number;
    roughness?: number;
}

const textureCache = new Map<string, THREE.Texture>();
const materialInstances = new Map<number, THREE.Material>();
const texLoader = new THREE.TextureLoader();

function defaultMode(mat: ResolvedMaterial): 'toon' | 'pbr' {
    const t = mat.shader_family.type;
    return t === 'Unknown' ? 'toon' : 'pbr';
}

export function buildMaterial(mat: ResolvedMaterial): THREE.Material {
    if (materialInstances.has(mat.slot_index)) {
        return materialInstances.get(mat.slot_index)!;
    }
    const m = createMaterial(mat, { mode: defaultMode(mat) });
    materialInstances.set(mat.slot_index, m);
    return m;
}

export function rebuildMaterial(mat: ResolvedMaterial, params: MaterialParams): THREE.Material {
    materialInstances.get(mat.slot_index)?.dispose();
    const m = createMaterial(mat, { mode: defaultMode(mat), ...params });
    materialInstances.set(mat.slot_index, m);
    return m;
}

export function updateMaterialParams(slotIndex: number, params: MaterialParams): void {
    const m = materialInstances.get(slotIndex);
    if (!m) return;
    if (params.emissionIntensity !== undefined) {
        (m as THREE.MeshStandardMaterial).emissiveIntensity = params.emissionIntensity;
    }
    if (params.normalScale !== undefined) {
        (m as THREE.MeshStandardMaterial).normalScale?.set(params.normalScale, params.normalScale);
    }
    if (m instanceof THREE.MeshStandardMaterial) {
        if (params.metallic !== undefined) m.metalness = params.metallic;
        if (params.roughness !== undefined) m.roughness = params.roughness;
    }
    m.needsUpdate = true;
}

export function getMaterialInstance(slotIndex: number): THREE.Material | null {
    return materialInstances.get(slotIndex) ?? null;
}

export function buildFallbackMaterial(): THREE.Material {
    return new THREE.MeshToonMaterial({ color: new THREE.Color(0xcccccc) });
}

function createMaterial(mat: ResolvedMaterial, params: MaterialParams): THREE.Material {
    const [r, g, b] = mat.color;
    const mode = params.mode ?? 'toon';

    const albedo = mat.albedo_path ? loadTextureCached(mat.albedo_path) : null;
    const normalMap = mat.normal_path ? loadTextureCached(mat.normal_path) : null;
    const emissionMap = mat.emission_path ? loadTextureCached(mat.emission_path) : null;

    const [er, eg, eb] = mat.emission_color;
    const hasEmission = emissionMap !== null || er > 0.001 || eg > 0.001 || eb > 0.001;
    const emissive = hasEmission ? new THREE.Color(er, eg, eb) : new THREE.Color(0, 0, 0);
    const emissiveIntensity = params.emissionIntensity ?? 0.0;
    const normalScale = params.normalScale ?? 1.0;

    if (mode === 'pbr') {
        return new THREE.MeshStandardMaterial({
            map: albedo,
            color: new THREE.Color(r, g, b),
            normalMap,
            normalScale: new THREE.Vector2(normalScale, normalScale),
            emissiveMap: emissionMap,
            emissive,
            emissiveIntensity: hasEmission ? emissiveIntensity : 0,
            metalness: params.metallic ?? mat.metallic,
            roughness: params.roughness ?? (1 - mat.smoothness),
            side: THREE.FrontSide,
        });
    }

    return new THREE.MeshToonMaterial({
        map: albedo,
        color: new THREE.Color(r, g, b),
        normalMap,
        normalScale: new THREE.Vector2(normalScale, normalScale),
        emissiveMap: emissionMap,
        emissive,
        emissiveIntensity: hasEmission ? emissiveIntensity : 0,
        side: THREE.FrontSide,
    });
}

function loadTextureCached(filePath: string): THREE.Texture {
    if (textureCache.has(filePath)) return textureCache.get(filePath)!;
    const url = convertFileSrc(filePath);
    const tex = texLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(filePath, tex);
    return tex;
}

export function clearTextureCache(): void {
    textureCache.forEach(tex => tex.dispose());
    textureCache.clear();
}

export function clearMaterialInstances(): void {
    materialInstances.forEach(m => m.dispose());
    materialInstances.clear();
}
