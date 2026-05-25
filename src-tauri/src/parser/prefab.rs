use std::collections::HashMap;
use anyhow::Result;
use serde_yaml::Value;

use crate::parser::guid_map::Guid;

#[derive(Debug, Clone, Default)]
pub struct RawGameObject {
    pub name: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Default)]
pub struct RawSkinnedMeshRenderer {
    pub file_id: u64,
    pub game_object_file_id: u64,
    pub mesh_guid: Option<Guid>,
    pub material_guids: Vec<Guid>,
}

#[derive(Debug, Clone, Default)]
pub struct PrefabData {
    pub game_objects: HashMap<u64, RawGameObject>,
    pub skinned_mesh_renderers: Vec<RawSkinnedMeshRenderer>,
}

struct UnityDoc {
    type_id: u32,
    file_id: u64,
    content: String,
}

fn split_unity_documents(content: &str) -> Vec<UnityDoc> {
    let mut docs = Vec::new();
    let mut current_type: u32 = 0;
    let mut current_file_id: u64 = 0;
    let mut current_lines: Vec<&str> = Vec::new();
    let mut in_doc = false;

    for line in content.lines() {
        if line.starts_with("%YAML") || line.starts_with("%TAG") {
            continue;
        }
        if line.starts_with("--- !u!") {
            if in_doc && !current_lines.is_empty() {
                docs.push(UnityDoc {
                    type_id: current_type,
                    file_id: current_file_id,
                    content: current_lines.join("\n"),
                });
                current_lines.clear();
            }
            let rest = &line["--- !u!".len()..];
            let parts: Vec<&str> = rest.split_whitespace().collect();
            current_type = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
            current_file_id = parts
                .get(1)
                .and_then(|s| s.strip_prefix('&'))
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
            in_doc = true;
        } else if in_doc {
            current_lines.push(line);
        }
    }
    if in_doc && !current_lines.is_empty() {
        docs.push(UnityDoc {
            type_id: current_type,
            file_id: current_file_id,
            content: current_lines.join("\n"),
        });
    }
    docs
}

fn get_u64(v: &Value) -> u64 {
    match v {
        Value::Number(n) => n.as_u64().unwrap_or(0),
        _ => 0,
    }
}

fn get_str<'a>(v: &'a Value) -> &'a str {
    if let Value::String(s) = v {
        s.as_str()
    } else {
        ""
    }
}

pub fn parse_prefab(content: &str) -> Result<PrefabData> {
    let docs = split_unity_documents(content);
    let mut data = PrefabData::default();

    for doc in &docs {
        let Ok(val): std::result::Result<Value, _> = serde_yaml::from_str(&doc.content) else {
            continue;
        };

        match doc.type_id {
            // GameObject
            1 => {
                if let Some(go) = val.get("GameObject") {
                    let name = go.get("m_Name").map(get_str).unwrap_or("").to_string();
                    let is_active = go.get("m_IsActive").map(get_u64).unwrap_or(1) != 0;
                    data.game_objects.insert(doc.file_id, RawGameObject { name, is_active });
                }
            }
            // SkinnedMeshRenderer
            137 => {
                if let Some(smr) = val.get("SkinnedMeshRenderer") {
                    let go_file_id = smr
                        .get("m_GameObject")
                        .and_then(|r| r.get("fileID"))
                        .map(get_u64)
                        .unwrap_or(0);

                    let mesh_guid = smr
                        .get("m_Mesh")
                        .and_then(|r| r.get("guid"))
                        .and_then(|v| if let Value::String(s) = v { Some(s.clone()) } else { None })
                        .filter(|s| !s.chars().all(|c| c == '0') && !s.is_empty());

                    let mut mat_guids = Vec::new();
                    if let Some(Value::Sequence(mats)) = smr.get("m_Materials") {
                        for m in mats {
                            if let Some(guid_val) = m.get("guid") {
                                if let Value::String(g) = guid_val {
                                    if !g.chars().all(|c| c == '0') && !g.is_empty() {
                                        mat_guids.push(g.clone());
                                    }
                                }
                            }
                        }
                    }

                    data.skinned_mesh_renderers.push(RawSkinnedMeshRenderer {
                        file_id: doc.file_id,
                        game_object_file_id: go_file_id,
                        mesh_guid,
                        material_guids: mat_guids,
                    });
                }
            }
            _ => {}
        }
    }

    Ok(data)
}
