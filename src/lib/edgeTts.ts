import { invoke } from "@tauri-apps/api/core";
import { exists, writeFile, readFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";

export interface EdgeTtsVoice {
  name: string;
  lang: string;
  gender: string;
}

const CACHE_DIR = "tts-cache";

async function ensureCacheDir(): Promise<void> {
  const dirExists = await exists(CACHE_DIR, { baseDir: BaseDirectory.AppData });
  if (!dirExists) {
    await mkdir(CACHE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

function cacheKey(text: string, voice: string, rate: number): string {
  // Simple hash from text+voice+rate
  let hash = 0;
  const str = `${voice}:${rate}:${text}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `${CACHE_DIR}/${(hash >>> 0).toString(36)}.mp3`;
}

export async function synthesize(
  text: string,
  voice: string,
  rate: number
): Promise<Uint8Array> {
  const key = cacheKey(text, voice, rate);

  // Check cache (non-fatal if fails)
  try {
    await ensureCacheDir();
    const cached = await exists(key, { baseDir: BaseDirectory.AppData });
    if (cached) {
      return await readFile(key, { baseDir: BaseDirectory.AppData });
    }
  } catch {
    // Cache miss or error, proceed to synthesize
  }

  // Call Rust backend
  console.log("[EdgeTTS] Synthesizing:", { voice, rate, textLen: text.length });
  const audioBytes = await invoke<number[]>("edge_tts_synthesize", {
    text,
    voice,
    rate,
  });
  console.log("[EdgeTTS] Got audio bytes:", audioBytes.length);

  const data = new Uint8Array(audioBytes);

  // Cache for future use
  writeFile(key, data, { baseDir: BaseDirectory.AppData }).catch(() => {});

  return data;
}

export async function getVoices(): Promise<EdgeTtsVoice[]> {
  return invoke<EdgeTtsVoice[]>("edge_tts_voices");
}

export function playAudio(data: Uint8Array): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.oncanplaythrough = () => resolve(audio);
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load audio"));
    };
  });
}
