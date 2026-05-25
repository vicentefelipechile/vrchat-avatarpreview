use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneGraph {
    pub nodes: Vec<SceneNode>,
    pub materials: Vec<ResolvedMaterial>,
    pub variant_groups: Vec<VariantGroup>,
    pub stats: AvatarStats,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneNode {
    pub name: String,
    /// Absolute path to the FBX file — served via asset protocol.
    pub fbx_path: String,
    pub active_by_default: bool,
    /// Indices into SceneGraph.materials.
    pub material_slots: Vec<usize>,
    pub children: Vec<SceneNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedMaterial {
    pub slot_index: u32,
    pub shader_family: ShaderFamily,
    pub shader_raw_name: String,
    pub albedo_path: Option<String>,
    pub normal_path: Option<String>,
    pub emission_path: Option<String>,
    pub color: [f32; 4],
    pub emission_color: [f32; 4],
    pub metallic: f32,
    pub smoothness: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "name")]
pub enum ShaderFamily {
    Poiyomi,
    LilToon,
    XSToon,
    Standard,
    URP,
    Unknown(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariantGroup {
    pub name: String,
    pub variants: Vec<String>,
    pub active_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvatarStats {
    pub triangle_count: u32,
    pub bone_count: u32,
    pub material_count: u32,
    pub blend_shape_count: u32,
    pub missing_dependencies: Vec<String>,
}
