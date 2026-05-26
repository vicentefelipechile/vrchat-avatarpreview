export interface SceneGraph {
    nodes: SceneNode[];
    materials: ResolvedMaterial[];
    variant_groups: VariantGroup[];
    stats: AvatarStats;
    warnings: string[];
}

export interface SceneNode {
    name: string;
    fbx_path: string;
    active_by_default: boolean;
    material_slots: number[];
    children: SceneNode[];
}

export type ShaderFamily =
    | { type: 'Poiyomi' }
    | { type: 'LilToon' }
    | { type: 'XSToon' }
    | { type: 'Standard' }
    | { type: 'URP' }
    | { type: 'Unknown'; name: string };

export interface ResolvedMaterial {
    slot_index: number;
    material_name: string;
    shader_family: ShaderFamily;
    shader_raw_name: string;
    albedo_path: string | null;
    normal_path: string | null;
    emission_path: string | null;
    color: [number, number, number, number];
    emission_color: [number, number, number, number];
    metallic: number;
    smoothness: number;
}

export interface VariantGroup {
    name: string;
    variants: string[];
    active_index: number;
}

export interface AvatarStats {
    triangle_count: number;
    bone_count: number;
    material_count: number;
    blend_shape_count: number;
    missing_dependencies: string[];
}

export function shaderFamilyLabel(family: ShaderFamily): string {
    switch (family.type) {
        case 'Poiyomi': return 'Poiyomi Toon';
        case 'LilToon': return 'lilToon';
        case 'XSToon':  return 'XSToon';
        case 'Standard': return 'Standard';
        case 'URP':     return 'URP Lit';
        case 'Unknown': return family.name || 'Unknown';
    }
}
