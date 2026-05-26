use std::collections::HashMap;
use std::fs;

use anyhow::Result;
use regex::Regex;

use crate::extractor::is_binary;
use crate::parser::classifier::{classify_by_extension, AssetKind};
use crate::parser::guid_map::{Guid, GuidMap};
use crate::parser::material::{parse_material, RawMaterial};
use crate::parser::prefab::{parse_prefab, PrefabData, RawSkinnedMeshRenderer};
use crate::parser::shader_compat::{detect_shader_family, infer_shader_from_props};
use crate::scene::{AvatarStats, ResolvedMaterial, SceneGraph, SceneNode, VariantGroup};

pub fn resolve(guid_map: &GuidMap) -> Result<SceneGraph> {
    let mut warnings: Vec<String> = Vec::new();

    // Classify all assets
    let meshes: Vec<&Guid> = guid_map
        .iter()
        .filter(|(_, e)| classify_by_extension(&e.pathname) == AssetKind::Mesh)
        .map(|(g, _)| g)
        .collect();

    let material_guids: Vec<&Guid> = guid_map
        .iter()
        .filter(|(_, e)| classify_by_extension(&e.pathname) == AssetKind::Material)
        .map(|(g, _)| g)
        .collect();

    let prefab_guids: Vec<&Guid> = guid_map
        .iter()
        .filter(|(_, e)| classify_by_extension(&e.pathname) == AssetKind::Prefab)
        .map(|(g, _)| g)
        .collect();

    // Parse all materials
    let mut raw_materials: HashMap<Guid, RawMaterial> = HashMap::new();
    for &guid in &material_guids {
        let entry = &guid_map[guid];
        let Some(ref asset_path) = entry.asset_path else {
            continue;
        };
        if is_binary(asset_path) {
            warnings.push(format!(
                "Material '{}' is in binary format — skipped.",
                entry.pathname
            ));
            continue;
        }
        match fs::read_to_string(asset_path) {
            Ok(content) => match parse_material(&content) {
                Ok(mat) => {
                    raw_materials.insert(guid.clone(), mat);
                }
                Err(e) => {
                    warnings.push(format!(
                        "Failed to parse material '{}': {e}",
                        entry.pathname
                    ));
                }
            },
            Err(e) => {
                warnings.push(format!("Cannot read material '{}': {e}", entry.pathname));
            }
        }
    }

    // Parse prefabs (use the first parseable one)
    let mut prefab_data: Option<PrefabData> = None;
    for &guid in &prefab_guids {
        let entry = &guid_map[guid];
        let Some(ref asset_path) = entry.asset_path else {
            continue;
        };
        if is_binary(asset_path) {
            warnings.push(format!(
                "Prefab '{}' is in binary format — object hierarchy unavailable.",
                entry.pathname
            ));
            continue;
        }
        match fs::read_to_string(asset_path) {
            Ok(content) => match parse_prefab(&content) {
                Ok(pd) if !pd.skinned_mesh_renderers.is_empty() => {
                    prefab_data = Some(pd);
                    break;
                }
                Ok(_) => {}
                Err(e) => {
                    warnings.push(format!(
                        "Failed to parse prefab '{}': {e}",
                        entry.pathname
                    ));
                }
            },
            Err(e) => {
                warnings.push(format!("Cannot read prefab '{}': {e}", entry.pathname));
            }
        }
    }

    // Build resolved materials list (global index list)
    let mut all_mat_guids: Vec<Guid> = Vec::new();
    let mut resolved_materials: Vec<ResolvedMaterial> = Vec::new();

    let collect_mat_guids_from_smrs = |smrs: &[RawSkinnedMeshRenderer]| -> Vec<Guid> {
        let mut guids = Vec::new();
        for smr in smrs {
            for g in &smr.material_guids {
                if !guids.contains(g) {
                    guids.push(g.clone());
                }
            }
        }
        guids
    };

    // Determine which material GUIDs we need
    let needed_mat_guids = if let Some(ref pd) = prefab_data {
        collect_mat_guids_from_smrs(&pd.skinned_mesh_renderers)
    } else {
        // No prefab — use all materials in the package
        material_guids.iter().map(|&g| g.clone()).collect()
    };

    for (slot_index, mat_guid) in needed_mat_guids.iter().enumerate() {
        all_mat_guids.push(mat_guid.clone());

        let raw = raw_materials.get(mat_guid);

        // Resolve shader
        let (shader_family, shader_raw_name) = if let Some(rm) = raw {
            if let Some(ref sg) = rm.shader_guid {
                if let Some(shader_entry) = guid_map.get(sg) {
                    (
                        detect_shader_family(&shader_entry.pathname),
                        shader_entry.pathname.clone(),
                    )
                } else {
                    // Shader file not bundled — infer family from material property names
                    let inferred = if let Some(rm) = raw {
                        let float_keys: Vec<&str> = rm.floats.keys().map(|s| s.as_str()).collect();
                        let tex_keys: Vec<&str> = rm.texture_guids.keys().map(|s| s.as_str()).collect();
                        infer_shader_from_props(&float_keys, &tex_keys)
                    } else {
                        None
                    };

                    if let Some(family) = inferred {
                        let raw_name = match &family {
                            crate::scene::ShaderFamily::Poiyomi => "Poiyomi Toon.shader",
                            crate::scene::ShaderFamily::LilToon => "lilToon.shader",
                            crate::scene::ShaderFamily::XSToon => "XSToon.shader",
                            _ => "External Shader",
                        };
                        (family, raw_name.to_string())
                    } else {
                        warnings.push(format!(
                            "Shader GUID {sg} not found in package — using fallback material."
                        ));
                        (
                            crate::scene::ShaderFamily::Unknown("External Shader".to_string()),
                            "External Shader".to_string(),
                        )
                    }
                }
            } else {
                (
                    crate::scene::ShaderFamily::Standard,
                    "Standard".to_string(),
                )
            }
        } else {
            warnings.push(format!(
                "Material GUID {mat_guid} not found or unreadable."
            ));
            (
                crate::scene::ShaderFamily::Unknown("Missing".to_string()),
                "Missing".to_string(),
            )
        };

        let resolve_tex = |rm: &crate::parser::material::RawMaterial, props: &[&str]| -> Option<String> {
            for prop in props {
                if let Some(tex_guid) = rm.texture_guids.get(*prop) {
                    if let Some(tex_entry) = guid_map.get(tex_guid) {
                        if let Some(ref ap) = tex_entry.asset_path {
                            return Some(ap.to_string_lossy().into_owned());
                        }
                    }
                }
            }
            None
        };

        let albedo_path = raw.and_then(|rm| {
            resolve_tex(rm, &["_MainTex", "_BaseMap", "_BaseColorMap", "_AlbedoTex"])
        });

        let normal_path = raw.and_then(|rm| {
            resolve_tex(rm, &["_BumpMap", "_NormalMap", "_DetailNormalMap"])
        });

        let emission_path = raw.and_then(|rm| {
            resolve_tex(rm, &["_EmissionMap", "_EmissiveMap"])
        });

        let color = raw.map(|rm| rm.color).unwrap_or([1.0, 1.0, 1.0, 1.0]);
        let emission_color = raw.map(|rm| rm.emission_color).unwrap_or([0.0, 0.0, 0.0, 0.0]);
        let metallic = raw.and_then(|rm| rm.floats.get("_Metallic").copied()).unwrap_or(0.0);
        let smoothness = raw
            .and_then(|rm| {
                rm.floats.get("_Glossiness")
                    .or_else(|| rm.floats.get("_Smoothness"))
                    .copied()
            })
            .unwrap_or(0.5);

        let material_name = guid_map
            .get(mat_guid)
            .and_then(|e| std::path::Path::new(&e.pathname).file_stem())
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        resolved_materials.push(ResolvedMaterial {
            slot_index: slot_index as u32,
            material_name,
            shader_family,
            shader_raw_name,
            albedo_path,
            normal_path,
            emission_path,
            color,
            emission_color,
            metallic,
            smoothness,
        });
    }

    // Build scene nodes
    let nodes = if let Some(ref pd) = prefab_data {
        build_nodes_from_prefab(pd, &all_mat_guids, guid_map, &mut warnings)
    } else {
        build_nodes_from_meshes(&meshes, &all_mat_guids, guid_map)
    };

    // Detect variant groups
    let variant_groups = detect_variant_groups(&nodes);

    // Stats
    let stats = AvatarStats {
        triangle_count: 0, // computed on frontend from Three.js geometry
        bone_count: 0,
        material_count: resolved_materials.len() as u32,
        blend_shape_count: 0,
        missing_dependencies: warnings
            .iter()
            .filter(|w| w.contains("not found in package"))
            .cloned()
            .collect(),
    };

    Ok(SceneGraph {
        nodes,
        materials: resolved_materials,
        variant_groups,
        stats,
        warnings,
    })
}

fn build_nodes_from_prefab(
    pd: &PrefabData,
    all_mat_guids: &[Guid],
    guid_map: &GuidMap,
    warnings: &mut Vec<String>,
) -> Vec<SceneNode> {
    let mut nodes = Vec::new();

    for smr in &pd.skinned_mesh_renderers {
        let go = pd.game_objects.get(&smr.game_object_file_id);
        let name = go
            .map(|g| g.name.clone())
            .unwrap_or_else(|| format!("Mesh_{}", smr.file_id));
        let active = go.map(|g| g.is_active).unwrap_or(true);

        let fbx_path = smr
            .mesh_guid
            .as_ref()
            .and_then(|g| guid_map.get(g))
            .and_then(|e| e.asset_path.as_ref())
            .map(|p| p.to_string_lossy().into_owned());

        let Some(fbx) = fbx_path else {
            if let Some(mesh_guid) = &smr.mesh_guid {
                warnings.push(format!(
                    "Mesh GUID {mesh_guid} for '{name}' not found in package."
                ));
            }
            continue;
        };

        let material_slots: Vec<usize> = smr
            .material_guids
            .iter()
            .filter_map(|mg| all_mat_guids.iter().position(|g| g == mg))
            .collect();

        nodes.push(SceneNode {
            name,
            fbx_path: fbx,
            active_by_default: active,
            material_slots,
            children: Vec::new(),
        });
    }

    nodes
}

fn build_nodes_from_meshes(
    meshes: &[&Guid],
    _all_mat_guids: &[Guid],
    guid_map: &GuidMap,
) -> Vec<SceneNode> {
    meshes
        .iter()
        .filter_map(|&guid| {
            let entry = guid_map.get(guid)?;
            let asset_path = entry.asset_path.as_ref()?;
            let name = std::path::Path::new(&entry.pathname)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string();
            Some(SceneNode {
                name,
                fbx_path: asset_path.to_string_lossy().into_owned(),
                active_by_default: true,
                material_slots: Vec::new(),
                children: Vec::new(),
            })
        })
        .collect()
}

fn detect_variant_groups(nodes: &[SceneNode]) -> Vec<VariantGroup> {
    // Strategy B: name inference
    let Ok(re) = Regex::new(r"(?i)^(.+?)(_[AB]|_[Vv]\d+|_[Oo]n|_[Oo]ff|_\d+)$") else {
        return Vec::new();
    };

    let mut groups: HashMap<String, Vec<(String, bool)>> = HashMap::new();

    for node in nodes {
        if let Some(caps) = re.captures(&node.name) {
            let prefix = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
            groups
                .entry(prefix)
                .or_default()
                .push((node.name.clone(), node.active_by_default));
        }
    }

    groups
        .into_iter()
        .filter(|(_, variants)| variants.len() >= 2)
        .map(|(name, variants)| {
            let active_index = variants
                .iter()
                .position(|(_, active)| *active)
                .unwrap_or(0);
            VariantGroup {
                name,
                variants: variants.into_iter().map(|(n, _)| n).collect(),
                active_index,
            }
        })
        .collect()
}
