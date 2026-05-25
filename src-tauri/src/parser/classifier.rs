use std::path::Path;

#[derive(Debug, Clone, PartialEq)]
pub enum AssetKind {
    Mesh,
    Material,
    Texture,
    Prefab,
    ShaderSource,
    Ignored,
}

pub fn classify_by_extension(pathname: &str) -> AssetKind {
    let ext = Path::new(pathname)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "fbx" => AssetKind::Mesh,
        "mat" => AssetKind::Material,
        "png" | "jpg" | "jpeg" | "tga" | "bmp" | "exr" | "hdr" | "psd" => AssetKind::Texture,
        "prefab" => AssetKind::Prefab,
        "shader" | "hlsl" | "cginc" | "glsl" => AssetKind::ShaderSource,
        _ => AssetKind::Ignored,
    }
}
