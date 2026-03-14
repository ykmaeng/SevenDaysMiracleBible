#[cfg(not(target_os = "android"))]
use font_kit::source::SystemSource;

#[tauri::command]
pub fn get_system_fonts() -> Vec<String> {
    #[cfg(not(target_os = "android"))]
    {
        let source = SystemSource::new();
        let mut families = source.all_families().unwrap_or_default();
        families.sort();
        families.dedup();
        families
    }

    #[cfg(target_os = "android")]
    {
        Vec::new()
    }
}
