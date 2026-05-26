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

/// Infer shader family from material property names when the shader file is not bundled.
/// Returns `None` if the properties don't match any known shader pattern.
pub fn infer_shader_from_props(float_keys: &[&str], tex_keys: &[&str]) -> Option<ShaderFamily> {
    // LilToon: nearly all custom properties start with "_lil"
    let liltoon_hits = float_keys.iter().filter(|k| k.to_lowercase().starts_with("_lil")).count()
        + tex_keys.iter().filter(|k| k.to_lowercase().starts_with("_lil")).count();
    if liltoon_hits >= 2 {
        return Some(ShaderFamily::LilToon);
    }

    // Poiyomi: properties unique to Poiyomi Toon that do not appear in Standard/URP
    const POI_PROPS: &[&str] = &[
        "_OutlineWidth",
        "_Saturation",
        "_LightingCapEnabled",
        "_GlitterToggle",
        "_AudioLinkEmission",
        "_RimLightingToggle",
        "_Iridescence",
        "_FurEnabled",
        "_PoiAlpha",
        "_ShatterToggle",
        "_RainbowToggle",
        "_BackFaceOverride",
        "_UDIMDiscardRow3_1",
    ];
    let poi_hits = float_keys.iter().filter(|k| POI_PROPS.contains(k)).count()
        + tex_keys.iter().filter(|k| POI_PROPS.contains(k)).count();
    if poi_hits >= 1 {
        return Some(ShaderFamily::Poiyomi);
    }

    // XSToon: uses a gradient ramp texture + specific toon toggle
    let has_xstoon = tex_keys.iter().any(|&k| k == "_Ramp")
        && float_keys.iter().any(|&k| k == "_FresnelToggle" || k == "_ShadingType");
    if has_xstoon {
        return Some(ShaderFamily::XSToon);
    }

    None
}

