use crate::scene::ShaderFamily;

pub fn detect_shader_family(shader_pathname: &str) -> ShaderFamily {
    let lower = shader_pathname.to_lowercase();

    if lower.contains("poiyomi") || lower.contains("poi/") || lower.contains(".poiyomi") {
        ShaderFamily::Poiyomi
    } else if lower.contains("liltoon") || lower.contains("lil_toon") || lower.contains("lilToon") {
        ShaderFamily::LilToon
    } else if lower.contains("xstoon") || lower.contains("xs/") || lower.contains("silent/") {
        ShaderFamily::XSToon
    } else if lower.contains("universal") || lower.contains("urp/") || lower.contains("urp_") {
        ShaderFamily::URP
    } else if lower.contains("standard") || lower.contains("autodesk") || lower.contains("nature/") {
        ShaderFamily::Standard
    } else {
        ShaderFamily::Unknown(shader_pathname.to_string())
    }
}

