use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

// Backend process state
pub struct BackendProcess(pub Mutex<Option<Child>>);

// Start the Node.js backend server
fn start_backend() -> Result<Child, std::io::Error> {
    let current_dir = std::env::current_dir()?;
    let backend_dir = current_dir.join("backend");
    
    #[cfg(target_os = "windows")]
    let node_command = "node.exe";
    
    #[cfg(not(target_os = "windows"))]
    let node_command = "node";

    println!("Starting backend from: {:?}", backend_dir);
    
    let child = Command::new(node_command)
        .arg("dist/cli/node.js")
        .current_dir(&backend_dir)
        .spawn()?;

    println!("Backend started with PID: {:?}", child.id());
    Ok(child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Start backend server on application startup
            let backend_process = match start_backend() {
                Ok(child) => {
                    println!("✓ Backend server started successfully");
                    Some(child)
                }
                Err(e) => {
                    eprintln!("✗ Failed to start backend: {}", e);
                    eprintln!("  The application may not function correctly.");
                    None
                }
            };

            // Store backend process in app state for cleanup on exit
            app.manage(BackendProcess(Mutex::new(backend_process)));

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Clean up backend process when window closes
                let state = window.state::<BackendProcess>();
                let mut process_guard = state.0.lock().unwrap();
                if let Some(mut child) = process_guard.take() {
                    println!("Stopping backend server...");
                    let _ = child.kill();
                    let _ = child.wait();
                    println!("✓ Backend server stopped");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
