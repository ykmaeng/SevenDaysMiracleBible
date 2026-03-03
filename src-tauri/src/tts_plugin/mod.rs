use serde::{Deserialize, Serialize};
use tauri::{
    command,
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};

#[cfg(mobile)]
mod mobile;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[cfg(mobile)]
    #[error(transparent)]
    PluginInvoke(#[from] tauri::plugin::mobile::PluginInvokeError),
    #[error("TTS not available on this platform")]
    NotAvailable,
}

impl Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpeakRequest {
    pub text: String,
    pub language: Option<String>,
    #[serde(default = "default_one")]
    pub rate: f32,
    #[serde(default = "default_one")]
    pub pitch: f32,
}

fn default_one() -> f32 {
    1.0
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SpeakResponse {
    pub success: bool,
    #[serde(default)]
    pub utterance_id: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct StopResponse {
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct IsSpeakingResponse {
    pub speaking: bool,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IsInitializedResponse {
    pub initialized: bool,
    pub voice_count: u32,
}

#[cfg(mobile)]
use mobile::TtsBridge;

#[cfg(mobile)]
trait TtsExt<R: Runtime> {
    fn tts(&self) -> &TtsBridge<R>;
}

#[cfg(mobile)]
impl<R: Runtime, T: Manager<R>> TtsExt<R> for T {
    fn tts(&self) -> &TtsBridge<R> {
        self.state::<TtsBridge<R>>().inner()
    }
}

#[command]
async fn tts_speak<R: Runtime>(app: AppHandle<R>, payload: SpeakRequest) -> Result<SpeakResponse> {
    #[cfg(mobile)]
    {
        app.tts().speak(payload)
    }
    #[cfg(not(mobile))]
    {
        let _ = app;
        let _ = payload;
        Err(Error::NotAvailable)
    }
}

#[command]
async fn tts_stop<R: Runtime>(app: AppHandle<R>) -> Result<StopResponse> {
    #[cfg(mobile)]
    {
        app.tts().stop()
    }
    #[cfg(not(mobile))]
    {
        let _ = app;
        Err(Error::NotAvailable)
    }
}

#[command]
async fn tts_is_speaking<R: Runtime>(app: AppHandle<R>) -> Result<IsSpeakingResponse> {
    #[cfg(mobile)]
    {
        app.tts().is_speaking()
    }
    #[cfg(not(mobile))]
    {
        let _ = app;
        Err(Error::NotAvailable)
    }
}

#[command]
async fn tts_is_initialized<R: Runtime>(app: AppHandle<R>) -> Result<IsInitializedResponse> {
    #[cfg(mobile)]
    {
        app.tts().is_initialized()
    }
    #[cfg(not(mobile))]
    {
        let _ = app;
        Err(Error::NotAvailable)
    }
}

/// Returns the Tauri command handler and a setup function for mobile bridge init.
pub fn commands<R: Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool {
    tauri::generate_handler![tts_speak, tts_stop, tts_is_speaking, tts_is_initialized]
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("tts")
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let bridge = mobile::init(app, api)?;
                app.manage(bridge);
            }
            #[cfg(not(mobile))]
            {
                let _ = app;
                let _ = api;
            }
            Ok(())
        })
        .build()
}
