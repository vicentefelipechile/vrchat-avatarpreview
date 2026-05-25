import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { SceneGraph, SceneNode } from '../types/scene';
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

    for (const node of graph.nodes) {
        try {
            const obj = await loadNode(node, graph, loaded);
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

async function loadNode(
    node: SceneNode,
    graph: SceneGraph,
    cache: Map<string, THREE.Group>
): Promise<THREE.Object3D | null> {
    const { fbx_path, name, material_slots } = node;

    let fbx: THREE.Group;

    if (cache.has(fbx_path)) {
        fbx = cache.get(fbx_path)!.clone() as THREE.Group;
    } else {
        const url = convertFileSrc(fbx_path);
        const raw = await fbxLoader.loadAsync(url);
        cache.set(fbx_path, raw);
        fbx = raw;
    }

    fbx.name = name;
    fbx.userData.loaded = true;

    fbx.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;

        const slotIdx = material_slots[0] ?? -1;
        const resolvedMat = slotIdx >= 0 ? graph.materials[slotIdx] : null;

        child.material = resolvedMat
            ? buildMaterial(resolvedMat)
            : buildFallbackMaterial();

        if (slotIdx >= 0) {
            const list = meshesBySlot.get(slotIdx) ?? [];
            list.push(child);
            meshesBySlot.set(slotIdx, list);
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
