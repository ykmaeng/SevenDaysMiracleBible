use std::fs;
use tauri::Manager;
use tauri_plugin_fs::FsExt;
use tauri_plugin_sql::{Migration, MigrationKind};

mod tts_plugin;

// Minimum size (bytes) for a valid bible.db with actual verse data.
// An empty schema-only DB is ~115KB; the real core DB is ~17MB.
const MIN_VALID_DB_SIZE: u64 = 1_000_000;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create schema",
            sql: include_str!("../migrations/001_create_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed books",
            sql: include_str!("../migrations/002_seed_books.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "update download sizes",
            sql: include_str!("../migrations/003_update_download_sizes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add translation_id to bookmarks",
            sql: include_str!("../migrations/005_bookmark_translation_id.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "paragraph breaks and section headings",
            sql: include_str!("../migrations/006_paragraph_and_sections.sql"),
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
        .invoke_handler(tts_plugin::commands());

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_sharesheet::init());
    }

    builder
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("bible.db");

            // Check if DB is missing or just an empty schema (< 1MB)
            let needs_copy = if db_path.exists() {
                match fs::metadata(&db_path) {
                    Ok(meta) => meta.len() < MIN_VALID_DB_SIZE,
                    Err(_) => true,
                }
            } else {
                true
            };

            if needs_copy {
                // Try platform-native fs::copy first (works on desktop)
                let resource_path = app
                    .path()
                    .resource_dir()
                    .ok()
                    .map(|d| d.join("resources").join("bible-core.db"));

                let copied = if let Some(ref rp) = resource_path {
                    if rp.exists() {
                        fs::copy(rp, &db_path).is_ok()
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
                        .resolve("resources/bible-core.db", tauri::path::BaseDirectory::Resource)
                        .ok();

                    if let Some(ref rf) = resource_file {
                        match app.fs().read(rf) {
                            Ok(bytes) => {
                                if let Err(e) = fs::write(&db_path, &bytes) {
                                    eprintln!("Failed to write bible.db: {e}");
                                } else {
                                    println!("Copied bible-core.db via Tauri fs ({} bytes)", bytes.len());
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to read bundled bible-core.db: {e}");
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
