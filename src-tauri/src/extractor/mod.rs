use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use flate2::read::GzDecoder;
use tar::Archive;
use uuid::Uuid;

use crate::parser::guid_map::{AssetEntry, Guid, GuidMap};

pub fn create_session_dir() -> Result<PathBuf> {
    let temp = std::env::temp_dir();
    let session_id = Uuid::new_v4().to_string();
    let session_dir = temp.join("avatarpreview").join(session_id);
    fs::create_dir_all(&session_dir).context("Failed to create session directory")?;
    Ok(session_dir)
}

pub fn extract_package(package_path: &str, session_dir: &Path) -> Result<GuidMap> {
    let file = File::open(package_path)
        .with_context(|| format!("Cannot open package: {package_path}"))?;

    let gz = GzDecoder::new(file);
    let mut archive = Archive::new(gz);

    archive
        .unpack(session_dir)
        .context("Failed to extract .unitypackage")?;

    build_guid_map(session_dir)
}

fn build_guid_map(session_dir: &Path) -> Result<GuidMap> {
    let mut map: GuidMap = GuidMap::new();

    for entry in fs::read_dir(session_dir).context("Cannot read session dir")? {
        let entry = entry?;
        let dir_path = entry.path();

        if !dir_path.is_dir() {
            continue;
        }

        let guid: Guid = match dir_path.file_name().and_then(|n| n.to_str()) {
            Some(name) if name.len() == 32 && name.chars().all(|c| c.is_ascii_hexdigit()) => {
                name.to_string()
            }
            _ => continue,
        };

        let pathname_file = dir_path.join("pathname");
        if !pathname_file.exists() {
            continue;
        }

        let pathname_content = fs::read_to_string(&pathname_file).unwrap_or_default();
        let pathname = pathname_content.lines().next().unwrap_or("").to_string();
        if pathname.is_empty() {
            continue;
        }

        let asset_file = dir_path.join("asset");
        let asset_path = if asset_file.exists() {
            Some(asset_file)
        } else {
            None
        };

        map.insert(guid, AssetEntry { pathname, asset_path });
    }

    Ok(map)
}

pub fn is_binary(path: &Path) -> bool {
    let mut buf = [0u8; 5];
    if let Ok(mut f) = File::open(path) {
        if let Ok(n) = f.read(&mut buf) {
            return n >= 5 && &buf[..5] != b"%YAML";
        }
    }
    true
}

pub fn cleanup_session(session_dir: &Path) {
    let _ = fs::remove_dir_all(session_dir);
}
