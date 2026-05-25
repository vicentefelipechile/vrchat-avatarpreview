use std::collections::HashMap;
use std::path::PathBuf;

pub type Guid = String;

#[derive(Debug, Clone)]
pub struct AssetEntry {
    /// Original Unity project path, e.g. "Assets/MyAvatar/MyAvatar.fbx"
    pub pathname: String,
    /// Path to the extracted asset file in the session dir.
    pub asset_path: Option<PathBuf>,
}

pub type GuidMap = HashMap<Guid, AssetEntry>;
