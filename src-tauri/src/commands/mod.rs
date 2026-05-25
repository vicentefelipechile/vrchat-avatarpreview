use std::path::PathBuf;
use std::sync::Mutex;

use anyhow::Result;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

use crate::extractor::{cleanup_session, create_session_dir, extract_package};
use crate::resolver::resolve;
use crate::scene::SceneGraph;

pub struct SessionState(pub Mutex<Option<PathBuf>>);

#[tauri::command]
pub fn open_file_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .add_filter("VRChat Package", &["unitypackage"])
        .blocking_pick_file();

    Ok(path.and_then(|fp| {
        use tauri_plugin_dialog::FilePath;
        match fp {
            FilePath::Path(p) => Some(p.to_string_lossy().into_owned()),
            _ => None,
        }
    }))
}

#[tauri::command]
pub async fn load_package(
    path: String,
    session: State<'_, SessionState>,
) -> Result<SceneGraph, String> {
    load_package_impl(path, session)
        .await
        .map_err(|e| e.to_string())
}

async fn load_package_impl(
    path: String,
    session: State<'_, SessionState>,
) -> Result<SceneGraph> {
    // Clean up previous session
    {
        let mut guard = session.0.lock().unwrap();
        if let Some(ref old_dir) = *guard {
            cleanup_session(old_dir);
        }
        *guard = None;
    }

    let session_dir = create_session_dir()?;

    let guid_map = extract_package(&path, &session_dir)?;

    let graph = resolve(&guid_map)?;

    {
        let mut guard = session.0.lock().unwrap();
        *guard = Some(session_dir);
    }

    Ok(graph)
}

#[tauri::command]
pub fn cleanup_session_cmd(session: State<'_, SessionState>) {
    let mut guard = session.0.lock().unwrap();
    if let Some(ref dir) = *guard {
        cleanup_session(dir);
    }
    *guard = None;
}
