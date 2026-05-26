import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { ResolvedMaterial, SceneGraph, SceneNode } from '../types/scene';
import { buildMaterial, buildFallbackMaterial, clearTextureCache, clearMaterialInstances } from './material-mapper';
import { clearMeshes, fitCameraToObject, getScene } from './scene';

const fbxLoader = new FBXLoader();
const nodeObjects = new Map<string, THREE.Object3D>();
const meshesBySlot = new Map<number, THREE.Mesh[]>();

export function getMeshesBySlot(slotIdx: number): THREE.Mesh[] {
    return meshesBySlot.get(slotIdx) ?? [];
}

export async function loadFbxNodes(graph: SceneGraph): Promise<void> {
    clearMaterialInstances();
    clearMeshes();
    clearTextureCache();
    nodeObjects.clear();
    meshesBySlot.clear();

    const scene = getScene();
    const group = new THREE.Group();
    group.userData.loaded = true;
    group.name = 'avatar-root';
    scene.add(group);

    const loaded = new Map<string, THREE.Group>();

    // Build name→material lookup for when prefab material slots are unavailable
    const matByName = new Map<string, ResolvedMaterial>();
    for (const mat of graph.materials) {
        if (mat.material_name) matByName.set(mat.material_name.toLowerCase(), mat);
    }

    for (const node of graph.nodes) {
        try {
            const obj = await loadNode(node, graph, matByName, loaded);
            if (obj) {
                group.add(obj);
                nodeObjects.set(node.name, obj);
                if (!node.active_by_default) obj.visible = false;
            }
        } catch (e) {
            console.warn(`Failed to load FBX for node '${node.name}':`, e);
        }
    }

    if (group.children.length > 0) {
        fitCameraToObject(group);
    }
}

function resolveMaterialForSlot(
    slotIndex: number,
    fbxMaterialName: string,
    materialSlots: number[],
    graph: SceneGraph,
    matByName: Map<string, ResolvedMaterial>
): ResolvedMaterial | null {
    if (materialSlots.length > 0) {
        const slotIdx = materialSlots[slotIndex] ?? materialSlots[0] ?? -1;
        return slotIdx >= 0 ? (graph.materials[slotIdx] ?? null) : null;
    }
    // No prefab slot assignments — match by the FBX's embedded material name
    const byName = matByName.get(fbxMaterialName.toLowerCase());
    if (byName) return byName;
    // Last resort: first resolved material
    return graph.materials[0] ?? null;
}

async function loadNode(
    node: SceneNode,
    graph: SceneGraph,
    matByName: Map<string, ResolvedMaterial>,
    cache: Map<string, THREE.Group>
): Promise<THREE.Object3D | null> {
    const { fbx_path, name, material_slots } = node;

    let fbx: THREE.Group;

    if (cache.has(fbx_path)) {
        fbx = cache.get(fbx_path)!.clone() as THREE.Group;
    } else {
        const url = convertFileSrc(fbx_path);
        const origWarn = console.warn;
        console.warn = (...args: unknown[]) => {
            if (typeof args[0] === 'string' && args[0].includes('skinning weights')) return;
            origWarn.apply(console, args);
        };
        const raw = await fbxLoader.loadAsync(url);
        console.warn = origWarn;
        cache.set(fbx_path, raw);
        fbx = raw;
    }

    fbx.name = name;
    fbx.userData.loaded = true;

    fbx.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;

        const fbxMats = Array.isArray(child.material) ? child.material : [child.material];

        if (fbxMats.length > 1) {
            // Multi-material mesh: assign one resolved material per FBX material slot
            child.material = fbxMats.map((fbxMat, i) => {
                const resolved = resolveMaterialForSlot(i, fbxMat?.name ?? '', material_slots, graph, matByName);
                if (resolved) {
                    const list = meshesBySlot.get(resolved.slot_index) ?? [];
                    list.push(child);
                    meshesBySlot.set(resolved.slot_index, list);
                    return buildMaterial(resolved);
                }
                return buildFallbackMaterial();
            });
        } else {
            const fbxMatName = (fbxMats[0] as THREE.Material | undefined)?.name ?? '';
            const resolved = resolveMaterialForSlot(0, fbxMatName, material_slots, graph, matByName);
            child.material = resolved ? buildMaterial(resolved) : buildFallbackMaterial();
            if (resolved) {
                const list = meshesBySlot.get(resolved.slot_index) ?? [];
                list.push(child);
                meshesBySlot.set(resolved.slot_index, list);
            }
        }

        if (child.morphTargetDictionary) {
            child.updateMorphTargets();
        }
    });

    return fbx;
}

export function setNodeVisible(name: string, visible: boolean): void {
    const obj = nodeObjects.get(name);
    if (obj) obj.visible = visible;
}

export function getNodeVisible(name: string): boolean {
    return nodeObjects.get(name)?.visible ?? true;
}
