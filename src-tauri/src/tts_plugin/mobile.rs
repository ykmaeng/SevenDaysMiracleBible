use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use super::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<TtsBridge<R>> {
    let handle = api.register_android_plugin("bible.selah.tts", "TtsPlugin")?;
    Ok(TtsBridge(handle))
}

pub struct TtsBridge<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> TtsBridge<R> {
    pub fn speak(&self, payload: SpeakRequest) -> Result<SpeakResponse> {
        self.0
            .run_mobile_plugin("speak", payload)
            .map_err(Into::into)
    }

    pub fn stop(&self) -> Result<StopResponse> {
        self.0
            .run_mobile_plugin("stop", ())
            .map_err(Into::into)
    }

    pub fn is_speaking(&self) -> Result<IsSpeakingResponse> {
        self.0
            .run_mobile_plugin("isSpeaking", ())
            .map_err(Into::into)
    }

    pub fn is_initialized(&self) -> Result<IsInitializedResponse> {
        self.0
            .run_mobile_plugin("isInitialized", ())
            .map_err(Into::into)
    }

    pub fn get_voices(&self) -> Result<GetVoicesResponse> {
        self.0
            .run_mobile_plugin("getVoices", ())
            .map_err(Into::into)
    }
}
