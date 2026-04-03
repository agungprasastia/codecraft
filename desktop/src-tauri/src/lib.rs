//! Codecraft Desktop - Tauri Backend
//!
//! This module provides the native backend for the Codecraft desktop application.
//! It handles window management and communication with the Node.js-based agent.

use tauri::{AppHandle, Manager};

/// Initialize the application
#[tauri::command]
fn initialize() -> String {
    "Ready! Type a message to start chatting with Codecraft.".to_string()
}

/// Send a message to the agent
/// Note: In a full implementation, this would spawn the codecraft CLI
/// and communicate via stdin/stdout
#[tauri::command]
async fn send_message(message: String) -> Result<String, String> {
    // For now, return a placeholder response
    // In production, this would invoke the codecraft CLI
    Ok(format!(
        "I received your message: \"{}\"\n\nNote: This is the desktop wrapper. \
        For full functionality, please use the CLI version while we complete \
        the desktop integration.",
        message
    ))
}

/// Minimize the window
#[tauri::command]
fn minimize_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
}

/// Toggle maximize/restore
#[tauri::command]
fn toggle_maximize(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

/// Exit the application
#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            initialize,
            send_message,
            minimize_window,
            toggle_maximize,
            exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
