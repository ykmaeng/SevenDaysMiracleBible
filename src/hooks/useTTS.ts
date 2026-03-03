import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/settingsStore";
import type { Verse } from "../types/bible";

// Platform detection
const isAndroid =
  typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

export interface TTSVoice {
  name: string;
  lang: string;
  localService: boolean;
}

interface TTSState {
  isAvailable: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentVerseIndex: number;
  voices: TTSVoice[];
}

interface TTSActions {
  play: (verses: Verse[], lang?: string, startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  getAvailableVoices: () => SpeechSynthesisVoice[];
}

// ========== Web Speech API helpers (desktop) ==========
function isUsableVoice(v: SpeechSynthesisVoice): boolean {
  return !v.name.includes("Eloquence");
}

function findVoiceForLang(
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice | undefined {
  return (
    voices.find((v) => isUsableVoice(v) && v.lang.startsWith(lang + "-")) ??
    voices.find((v) => isUsableVoice(v) && v.lang === lang)
  );
}

function checkWebTTS(): boolean {
  if (isAndroid) return false; // Skip Web Speech API on Android
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window))
      return false;
    window.speechSynthesis.getVoices();
    return true;
  } catch {
    return false;
  }
}

const hasWebTTS = checkWebTTS();

function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (!hasWebTTS) return Promise.resolve([]);
  try {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) return Promise.resolve(voices);
  } catch {
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 3000);
    const onVoicesChanged = () => {
      clearTimeout(timeout);
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        onVoicesChanged
      );
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
  });
}

// ========== Native TTS helpers (Android) ==========
async function nativeIsAvailable(): Promise<boolean> {
  try {
    const r = await invoke<{ initialized: boolean; voiceCount: number }>(
      "tts_is_initialized"
    );
    return r.initialized && r.voiceCount > 0;
  } catch {
    return false;
  }
}

async function nativeSpeak(
  text: string,
  language?: string,
  rate?: number,
  voice?: string
): Promise<void> {
  await invoke("tts_speak", {
    payload: { text, language: language ?? null, voice: voice ?? null, rate: rate ?? 1.0, pitch: 1.0 },
  });
}

async function nativeGetVoices(): Promise<TTSVoice[]> {
  try {
    const r = await invoke<{ voices: TTSVoice[] }>("tts_get_voices");
    return r.voices ?? [];
  } catch {
    return [];
  }
}

async function nativeStop(): Promise<void> {
  try {
    await invoke("tts_stop");
  } catch {
    // ignore
  }
}

// ========== Hook ==========
export function useTTS(): TTSState & TTSActions {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [voices, setVoices] = useState<TTSVoice[]>([]);

  const versesRef = useRef<Verse[]>([]);
  const langRef = useRef("");
  const stoppedRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speakVerseRef = useRef<((index: number) => void) | null>(null);

  // Check availability on mount
  useEffect(() => {
    if (isAndroid) {
      // Wait briefly for native TTS init then check
      const timer = setTimeout(() => {
        nativeIsAvailable().then((avail) => {
          setIsAvailable(avail);
          if (avail) {
            nativeGetVoices().then(setVoices);
          }
        });
      }, 500);
      return () => clearTimeout(timer);
    } else if (hasWebTTS) {
      ensureVoicesLoaded().then((v) => {
        voicesRef.current = v;
        setVoices(v.map((sv) => ({ name: sv.name, lang: sv.lang, localService: sv.localService })));
        setIsAvailable(v.length > 0);
      });
      const update = () => {
        const v = window.speechSynthesis.getVoices();
        voicesRef.current = v;
        setVoices(v.map((sv) => ({ name: sv.name, lang: sv.lang, localService: sv.localService })));
        if (v.length > 0) setIsAvailable(true);
      };
      window.speechSynthesis.addEventListener("voiceschanged", update);
      return () =>
        window.speechSynthesis.removeEventListener("voiceschanged", update);
    }
  }, []);

  // speakVerse — reads settings from the store for fresh values
  speakVerseRef.current = (index: number) => {
    const verses = versesRef.current;
    if (index >= verses.length || stoppedRef.current) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentVerseIndex(0);
      return;
    }

    setCurrentVerseIndex(index);

    if (isAndroid) {
      // Native Android TTS — speak returns a Promise that resolves when speech finishes
      const { ttsSpeed, ttsVoiceName } = useSettingsStore.getState();
      const lang = langRef.current;
      nativeSpeak(verses[index].text, lang || undefined, ttsSpeed, ttsVoiceName || undefined)
        .then(() => {
          if (!stoppedRef.current) {
            speakVerseRef.current?.(index + 1);
          }
        })
        .catch(() => {
          setIsPlaying(false);
          setIsPaused(false);
        });
    } else {
      // Web Speech API (desktop)
      const { ttsSpeed, ttsVoiceName } = useSettingsStore.getState();
      const utterance = new SpeechSynthesisUtterance(verses[index].text);
      utterance.rate = ttsSpeed;

      const lang = langRef.current;
      if (lang) utterance.lang = lang;

      const voices = voicesRef.current;
      if (ttsVoiceName) {
        const voice = voices.find((v) => v.name === ttsVoiceName);
        if (voice) utterance.voice = voice;
      } else if (lang) {
        const voice = findVoiceForLang(voices, lang);
        if (voice) utterance.voice = voice;
      }

      utterance.onend = () => {
        if (!stoppedRef.current) {
          speakVerseRef.current?.(index + 1);
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") {
          setIsPlaying(false);
          setIsPaused(false);
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const play = useCallback((verses: Verse[], lang = "", startIndex = 0) => {
    stoppedRef.current = true;
    if (isAndroid) {
      nativeStop();
    } else if (hasWebTTS) {
      window.speechSynthesis.cancel();
    }

    versesRef.current = verses;
    langRef.current = lang;
    stoppedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);

    if (isAndroid) {
      speakVerseRef.current?.(startIndex);
    } else {
      ensureVoicesLoaded().then((v) => {
        voicesRef.current = v;
        if (!stoppedRef.current) {
          speakVerseRef.current?.(startIndex);
        }
      });
    }
  }, []);

  const pause = useCallback(() => {
    if (!isAndroid && hasWebTTS && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
    // Android native TTS doesn't support pause — only stop
  }, []);

  const resume = useCallback(() => {
    if (!isAndroid && hasWebTTS && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (isAndroid) {
      nativeStop();
    } else if (hasWebTTS) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentVerseIndex(0);
  }, []);

  const getAvailableVoices = useCallback(() => {
    return voicesRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (isAndroid) {
        nativeStop();
      } else if (hasWebTTS) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isAvailable,
    isPlaying,
    isPaused,
    currentVerseIndex,
    voices,
    play,
    pause,
    resume,
    stop,
    getAvailableVoices,
  };
}
