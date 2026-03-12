use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio_tungstenite::{connect_async, tungstenite::Message};

const TRUSTED_TOKEN: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION: &str = "1-143.0.3650.75";
const WIN_EPOCH: u64 = 11_644_473_600;

fn generate_gec_token() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // Convert to Windows ticks: add Win epoch, round to 5min, then to 100ns intervals
    let secs = now + WIN_EPOCH;
    let rounded = secs - (secs % 300); // 5 minutes = 300 seconds
    let ticks = (rounded as f64 * 1e9 / 100.0) as u64; // 100-nanosecond intervals
    let input = format!("{ticks}{TRUSTED_TOKEN}");
    let hash = Sha256::digest(input.as_bytes());
    hash.iter()
        .map(|b| format!("{:02X}", b))
        .collect::<String>()
}

fn random_hex(len: usize) -> String {
    let mut rng = rand::thread_rng();
    (0..len).map(|_| format!("{:02x}", rng.gen::<u8>())).collect()
}

fn timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    // Simple ISO-like timestamp
    format!("{}", now)
}

fn build_ssml(text: &str, voice: &str, rate: f32) -> String {
    let rate_pct = ((rate - 1.0) * 100.0).round() as i32;
    let rate_str = if rate_pct >= 0 {
        format!("+{rate_pct}%")
    } else {
        format!("{rate_pct}%")
    };
    // Escape XML special chars
    let escaped = text
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");

    format!(
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\
         <voice name='{voice}'>\
         <prosody rate='{rate_str}' pitch='+0Hz'>{escaped}</prosody>\
         </voice></speak>"
    )
}

pub async fn synthesize(text: &str, voice: &str, rate: f32) -> Result<Vec<u8>, String> {
    let gec = generate_gec_token();
    let url = format!(
        "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1\
         ?TrustedClientToken={TRUSTED_TOKEN}\
         &Sec-MS-GEC={gec}\
         &Sec-MS-GEC-Version={SEC_MS_GEC_VERSION}"
    );

    let request = tokio_tungstenite::tungstenite::http::Request::builder()
        .uri(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0")
        .header("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
        .header("Host", "speech.platform.bing.com")
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .header("Sec-WebSocket-Version", "13")
        .header("Sec-WebSocket-Key", tokio_tungstenite::tungstenite::handshake::client::generate_key())
        .body(())
        .map_err(|e| format!("Failed to build request: {e}"))?;

    let (mut ws, _) = connect_async(request)
        .await
        .map_err(|e| format!("WebSocket connect failed: {e}"))?;

    // Send config
    let ts = timestamp();
    let config_msg = format!(
        "X-Timestamp:{ts}\r\n\
         Content-Type:application/json; charset=utf-8\r\n\
         Path:speech.config\r\n\r\n\
         {{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":{{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"}},\"outputFormat\":\"audio-24khz-96kbitrate-mono-mp3\"}}}}}}}}"
    );
    ws.send(Message::Text(config_msg.into()))
        .await
        .map_err(|e| format!("Send config failed: {e}"))?;

    // Send SSML
    let request_id = random_hex(16);
    let ssml = build_ssml(text, voice, rate);
    let ssml_msg = format!(
        "X-RequestId:{request_id}\r\n\
         Content-Type:application/ssml+xml\r\n\
         X-Timestamp:{ts}\r\n\
         Path:ssml\r\n\r\n\
         {ssml}"
    );
    ws.send(Message::Text(ssml_msg.into()))
        .await
        .map_err(|e| format!("Send SSML failed: {e}"))?;

    // Receive audio
    let mut audio = Vec::new();

    while let Some(msg) = ws.next().await {
        match msg {
            Ok(Message::Binary(data)) => {
                if data.len() < 2 {
                    continue;
                }
                let header_len = u16::from_be_bytes([data[0], data[1]]) as usize;
                let audio_start = 2 + header_len;
                if audio_start < data.len() {
                    let header = String::from_utf8_lossy(&data[2..audio_start]);
                    if header.contains("Path:audio") {
                        audio.extend_from_slice(&data[audio_start..]);
                    }
                }
            }
            Ok(Message::Text(txt)) => {
                if txt.contains("Path:turn.end") {
                    break;
                }
            }
            Ok(Message::Close(_)) => break,
            Err(e) => return Err(format!("WebSocket error: {e}")),
            _ => {}
        }
    }

    let _ = ws.close(None).await;

    if audio.is_empty() {
        return Err("No audio received".to_string());
    }

    Ok(audio)
}

// Available Edge TTS voices (commonly used)
pub fn get_voices() -> Vec<(&'static str, &'static str, &'static str)> {
    // (name, lang, gender)
    vec![
        ("ko-KR-SunHiNeural", "ko", "Female"),
        ("ko-KR-InJoonNeural", "ko", "Male"),
        ("ko-KR-HyunsuNeural", "ko", "Male"),
        ("ko-KR-BongJinNeural", "ko", "Male"),
        ("ko-KR-GookMinNeural", "ko", "Male"),
        ("ko-KR-JiMinNeural", "ko", "Female"),
        ("ko-KR-SeoHyeonNeural", "ko", "Female"),
        ("ko-KR-SoonBokNeural", "ko", "Female"),
        ("ko-KR-YuJinNeural", "ko", "Female"),
        ("en-US-EmmaMultilingualNeural", "en", "Female"),
        ("en-US-JennyNeural", "en", "Female"),
        ("en-US-GuyNeural", "en", "Male"),
        ("en-US-AriaNeural", "en", "Female"),
        ("en-US-AndrewMultilingualNeural", "en", "Male"),
        ("en-US-BrianMultilingualNeural", "en", "Male"),
        ("en-GB-SoniaNeural", "en", "Female"),
        ("en-GB-RyanNeural", "en", "Male"),
        ("ja-JP-NanamiNeural", "ja", "Female"),
        ("ja-JP-KeitaNeural", "ja", "Male"),
        ("zh-CN-XiaoxiaoNeural", "zh", "Female"),
        ("zh-CN-YunxiNeural", "zh", "Male"),
        ("es-ES-ElviraNeural", "es", "Female"),
        ("fr-FR-DeniseNeural", "fr", "Female"),
        ("de-DE-KatjaNeural", "de", "Female"),
        ("pt-BR-FranciscaNeural", "pt", "Female"),
        ("ru-RU-SvetlanaNeural", "ru", "Female"),
    ]
}
