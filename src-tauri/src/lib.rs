mod extractor;
mod parser;
mod resolver;
mod scene;
mod commands;

use commands::SessionState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(SessionState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::open_file_dialog,
            commands::load_package,
            commands::cleanup_session_cmd,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<SessionState>();
                let guard = state.0.lock().unwrap();
                if let Some(dir) = guard.as_ref() {
                    crate::extractor::cleanup_session(dir);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
