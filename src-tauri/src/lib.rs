use std::fs;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Copy bundled bible.db to app data directory if it doesn't exist
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("bible.db");

            if !db_path.exists() {
                let resource_path = app
                    .path()
                    .resource_dir()?
                    .join("resources")
                    .join("bible-core.db");

                if resource_path.exists() {
                    fs::copy(&resource_path, &db_path)?;
                    println!("Copied bundled bible-core.db to {:?}", db_path);
                } else {
                    println!("Warning: bundled bible.db not found at {:?}", resource_path);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
