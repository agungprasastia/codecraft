//! Codecraft Desktop - Tauri Backend
//!
//! This module provides the native backend for the Codecraft desktop application.
//! It handles window management and communication with the Node.js-based agent.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
struct ChatRequest {
    message: String,
    provider: String,
    model: String,
    mode: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    content: String,
}

fn get_default_provider() -> String {
    std::env::var("CODECRAFT_DESKTOP_PROVIDER").unwrap_or_else(|_| "ollama".to_string())
}

fn get_default_model(provider: &str) -> String {
    if let Ok(model) = std::env::var("CODECRAFT_DESKTOP_MODEL") {
        if !model.trim().is_empty() {
            return model;
        }
    }

    match provider {
        "openai" => "gpt-4-turbo-preview".to_string(),
        "anthropic" => "claude-3-opus-20240229".to_string(),
        "google" => "gemini-pro".to_string(),
        _ => "llama2".to_string(),
    }
}

/// Initialize the application
#[tauri::command]
fn initialize() -> String {
    "Ready! Type a message to start chatting with Codecraft.".to_string()
}

/// Send a message to the agent
/// Bridge request from desktop UI to local Codecraft HTTP server.
#[tauri::command]
async fn send_message(message: String) -> Result<String, String> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("Message cannot be empty".to_string());
    }

    let provider = get_default_provider();
    let model = get_default_model(&provider);

    let payload = ChatRequest {
        message: trimmed.to_string(),
        provider,
        model,
        mode: "build".to_string(),
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let response = client
        .post("http://127.0.0.1:3000/chat-sync")
        .json(&payload)
        .send()
        .await
        .map_err(|error| {
            format!(
                "Cannot reach Codecraft server on http://127.0.0.1:3000. Start it with: npm run server\n\nDetails: {}",
                error
            )
        })?;

    if !response.status().is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown error".to_string());
        return Err(format!("Server returned {}: {}", response.status(), error_text));
    }

    let data: ChatResponse = response
        .json()
        .await
        .map_err(|error| format!("Failed to decode server response: {}", error))?;

    Ok(data.content)
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
