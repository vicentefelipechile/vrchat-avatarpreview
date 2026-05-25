use std::collections::HashMap;
use anyhow::{Result, anyhow};
use serde_yaml::Value;

use crate::parser::guid_map::Guid;

#[derive(Debug, Clone, Default)]
pub struct RawMaterial {
    pub shader_guid: Option<Guid>,
    pub color: [f32; 4],
    pub emission_color: [f32; 4],
    pub texture_guids: HashMap<String, Guid>,
    pub floats: HashMap<String, f32>,
}

fn strip_unity_headers(content: &str) -> String {
    content
        .lines()
        .filter(|line| {
            !line.starts_with("%YAML")
                && !line.starts_with("%TAG")
                && !line.starts_with("--- !")
                && *line != "---"
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn get_f32(v: &Value) -> f32 {
    match v {
        Value::Number(n) => n.as_f64().unwrap_or(1.0) as f32,
        _ => 1.0,
    }
}

fn get_str<'a>(v: &'a Value) -> Option<&'a str> {
    if let Value::String(s) = v {
        Some(s.as_str())
    } else {
        None
    }
}

pub fn parse_material(content: &str) -> Result<RawMaterial> {
    if !content.starts_with("%YAML") && !content.trim_start().starts_with("Material:") {
        return Err(anyhow!("Not a text-format material"));
    }

    let stripped = strip_unity_headers(content);
    let doc: Value = serde_yaml::from_str(&stripped)?;

    let mat_node = doc
        .get("Material")
        .ok_or_else(|| anyhow!("No Material key"))?;

    let mut result = RawMaterial::default();
    result.color = [1.0, 1.0, 1.0, 1.0];

    // Parse shader GUID
    if let Some(shader_ref) = mat_node.get("m_Shader") {
        if let Some(guid) = shader_ref.get("guid").and_then(get_str) {
            if !guid.chars().all(|c| c == '0') {
                result.shader_guid = Some(guid.to_string());
            }
        }
    }

    // Parse saved properties
    if let Some(props) = mat_node.get("m_SavedProperties") {
        // Parse colors: list of single-key maps
        if let Some(Value::Sequence(colors)) = props.get("m_Colors") {
            for entry in colors {
                if let Value::Mapping(map) = entry {
                    for (key, val) in map {
                        let key_str = get_str(key).unwrap_or("");
                        let rgba = [
                            get_f32(val.get("r").unwrap_or(&Value::Number(0.0.into()))),
                            get_f32(val.get("g").unwrap_or(&Value::Number(0.0.into()))),
                            get_f32(val.get("b").unwrap_or(&Value::Number(0.0.into()))),
                            get_f32(val.get("a").unwrap_or(&Value::Number(1.0.into()))),
                        ];
                        if key_str == "_Color" || key_str == "_BaseColor" {
                            result.color = [rgba[0].max(0.0), rgba[1].max(0.0), rgba[2].max(0.0), rgba[3]];
                            if result.color == [0.0, 0.0, 0.0, 0.0] {
                                result.color = [1.0, 1.0, 1.0, 1.0];
                            }
                        } else if key_str == "_EmissionColor" {
                            result.emission_color = rgba;
                        }
                    }
                }
            }
        }

        // Parse floats: list of single-key maps
        if let Some(Value::Sequence(floats)) = props.get("m_Floats") {
            for entry in floats {
                if let Value::Mapping(map) = entry {
                    for (key, val) in map {
                        let key_str = get_str(key).unwrap_or("").to_string();
                        result.floats.insert(key_str, get_f32(val));
                    }
                }
            }
        }

        // Parse textures: list of single-key maps
        if let Some(Value::Sequence(texenvs)) = props.get("m_TexEnvs") {
            for entry in texenvs {
                if let Value::Mapping(map) = entry {
                    for (prop_name, tex_val) in map {
                        let prop_str = get_str(prop_name).unwrap_or("").to_string();
                        if let Some(tex_ref) = tex_val.get("m_Texture") {
                            if let Some(guid) = tex_ref.get("guid").and_then(get_str) {
                                if !guid.chars().all(|c| c == '0') {
                                    result.texture_guids.insert(prop_str, guid.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(result)
}
