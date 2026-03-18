use std::fs;
use tauri::Manager;
use tauri_plugin_fs::FsExt;
use tauri_plugin_sql::{Migration, MigrationKind};

mod edge_tts;
mod fonts_plugin;
mod tts_plugin;

#[derive(serde::Serialize)]
struct EdgeTtsVoice {
    name: &'static str,
    lang: &'static str,
    gender: &'static str,
}

#[tauri::command]
async fn edge_tts_synthesize(text: String, voice: String, rate: f32) -> Result<Vec<u8>, String> {
    edge_tts::synthesize(&text, &voice, rate).await
}

#[tauri::command]
fn edge_tts_voices() -> Vec<EdgeTtsVoice> {
    edge_tts::get_voices()
        .into_iter()
        .map(|(name, lang, gender)| EdgeTtsVoice { name, lang, gender })
        .collect()
}

/// Bundled translation DB files to copy on first run.
const BUNDLED_TRANSLATION_DBS: &[&str] = &["kjv.db", "sav-ko.db", "sav-en.db"];

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_niv_esv",
            sql: include_str!("../migrations/002_add_niv_esv.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_sav_en",
            sql: include_str!("../migrations/003_add_sav_en.sql"),
            kind: MigrationKind::Up,
        },
    ];

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:bible.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tts_plugin::init())
        .invoke_handler(tauri::generate_handler![
            tts_plugin::tts_speak,
            tts_plugin::tts_stop,
            tts_plugin::tts_is_speaking,
            tts_plugin::tts_is_initialized,
            tts_plugin::tts_get_voices,
            edge_tts_synthesize,
            edge_tts_voices,
            fonts_plugin::get_system_fonts,
        ]);

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_sharesheet::init());
    }

    builder
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;

            // Copy bundled resource files to app data dir if missing
            let files_to_copy: Vec<(&str, &str)> = std::iter::once(("bible-core.db", "bible.db"))
                .chain(BUNDLED_TRANSLATION_DBS.iter().map(|f| (*f, *f)))
                .collect();

            for (resource_name, dest_name) in &files_to_copy {
                let dest_path = app_data_dir.join(dest_name);
                if dest_path.exists() {
                    continue;
                }

                // Try platform-native fs::copy first (works on desktop)
                let resource_path = app
                    .path()
                    .resource_dir()
                    .ok()
                    .map(|d| d.join("resources").join(resource_name));

                let copied = if let Some(ref rp) = resource_path {
                    if rp.exists() {
                        fs::copy(rp, &dest_path).is_ok()
                    } else {
                        false
                    }
                } else {
                    false
                };

                // Fallback: use Tauri fs plugin (works on Android where resources are in APK assets)
                if !copied {
                    let resource_file = app
                        .path()
                        .resolve(
                            &format!("resources/{resource_name}"),
                            tauri::path::BaseDirectory::Resource,
                        )
                        .ok();

                    if let Some(ref rf) = resource_file {
                        match app.fs().read(rf) {
                            Ok(bytes) => {
                                if let Err(e) = fs::write(&dest_path, &bytes) {
                                    eprintln!("Failed to write {dest_name}: {e}");
                                } else {
                                    println!("Copied {resource_name} -> {dest_name} ({} bytes)", bytes.len());
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to read bundled {resource_name}: {e}");
                            }
                        }
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
