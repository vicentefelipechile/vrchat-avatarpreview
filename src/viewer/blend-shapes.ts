import * as THREE from 'three';
import { getScene } from './scene';

export interface BlendShape {
    cleanName: string;
    rawName: string;
    meshRef: THREE.Mesh;
    index: number;
    defaultValue: number;
    category: 'Body' | 'Clothing' | 'Other';
}

const BODY_KEYWORDS = [
    'waist', 'chest', 'belly', 'hip', 'breast', 'bust',
    'thigh', 'arm', 'leg', 'shoulder', 'neck', 'back',
];
const CLOTHING_KEYWORDS = [
    'outfit', 'cloth', 'sleeve', 'collar', 'skirt', 'sock',
    'shoe', 'boot', 'glove', 'hat', 'hood', 'cape',
];

function cleanName(raw: string): string {
    return raw.replace(/^blendShape\d+\./, '');
}

function categorize(name: string): BlendShape['category'] {
    const lower = name.toLowerCase();
    if (BODY_KEYWORDS.some(k => lower.includes(k))) return 'Body';
    if (CLOTHING_KEYWORDS.some(k => lower.includes(k))) return 'Clothing';
    return 'Other';
}

let cachedShapes: BlendShape[] = [];

export function collectBlendShapes(): BlendShape[] {
    const scene = getScene();
    const shapes: BlendShape[] = [];

    scene.traverse(obj => {
        if (!(obj instanceof THREE.Mesh)) return;
        const dict = obj.morphTargetDictionary;
        if (!dict) return;

        for (const [rawName, index] of Object.entries(dict)) {
            const name = cleanName(rawName);
            const defaultValue = obj.morphTargetInfluences?.[index] ?? 0;
            shapes.push({
                cleanName: name,
                rawName,
                meshRef: obj,
                index,
                defaultValue,
                category: categorize(name),
            });
        }
    });

    cachedShapes = shapes;
    return shapes;
}

export function getCachedShapes(): BlendShape[] {
    return cachedShapes;
}

export function setBlendShape(shape: BlendShape, value: number): void {
    if (!shape.meshRef.morphTargetInfluences) return;
    shape.meshRef.morphTargetInfluences[shape.index] = value;
}
