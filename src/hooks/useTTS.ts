import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/settingsStore";
import { synthesize as edgeSynthesize, getVoices as getEdgeVoices, type EdgeTtsVoice } from "../lib/edgeTts";
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

// Default Edge TTS voice per language
const EDGE_DEFAULT_VOICE: Record<string, string> = {
  ko: "ko-KR-SunHiNeural",
  en: "en-US-JennyNeural",
  ja: "ja-JP-NanamiNeural",
  zh: "zh-CN-XiaoxiaoNeural",
  es: "es-ES-ElviraNeural",
  fr: "fr-FR-DeniseNeural",
  de: "de-DE-KatjaNeural",
  pt: "pt-BR-FranciscaNeural",
  ru: "ru-RU-SvetlanaNeural",
};

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
  if (isAndroid) return false;
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
  const sessionIdRef = useRef(0);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speakVerseRef = useRef<((index: number) => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const edgeVoicesRef = useRef<EdgeTtsVoice[]>([]);
  const prefetchCache = useRef<Map<string, Promise<Uint8Array>>>(new Map());

  // Fetch native voices with retry
  const fetchNativeVoices = useCallback(() => {
    if (!isAndroid) return;
    nativeGetVoices().then((v) => {
      if (v.length > 0) setVoices(v);
    });
  }, []);

  // Fetch Edge TTS voice list
  useEffect(() => {
    getEdgeVoices().then((v) => {
      edgeVoicesRef.current = v;
    }).catch(() => {});
  }, []);

  // Check availability on mount
  useEffect(() => {
    // Edge TTS is always potentially available (online)
    // So mark as available immediately
    setIsAvailable(true);

    if (isAndroid) {
      const timer = setTimeout(() => {
        nativeIsAvailable().then((avail) => {
          if (avail) {
            fetchNativeVoices();
            setTimeout(fetchNativeVoices, 2000);
          }
        });
      }, 500);
      return () => clearTimeout(timer);
    } else if (hasWebTTS) {
      ensureVoicesLoaded().then((v) => {
        voicesRef.current = v;
        setVoices(v.map((sv) => ({ name: sv.name, lang: sv.lang, localService: sv.localService })));
      });
      const update = () => {
        const v = window.speechSynthesis.getVoices();
        voicesRef.current = v;
        setVoices(v.map((sv) => ({ name: sv.name, lang: sv.lang, localService: sv.localService })));
      };
      window.speechSynthesis.addEventListener("voiceschanged", update);
      return () =>
        window.speechSynthesis.removeEventListener("voiceschanged", update);
    }
  }, []);

  // Stop Edge TTS audio helper
  const stopEdgeAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      const src = audioRef.current.src;
      audioRef.current = null;
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
    }
  }, []);

  // Prefetch Edge TTS audio (returns cached promise if already in-flight)
  const prefetchEdge = useCallback((text: string, voice: string, rate: number): Promise<Uint8Array> => {
    const key = `${voice}:${rate}:${text}`;
    const cached = prefetchCache.current.get(key);
    if (cached) return cached;
    const promise = edgeSynthesize(text, voice, rate);
    prefetchCache.current.set(key, promise);
    // Clean up cache entry after completion (success or fail)
    promise.finally(() => {
      setTimeout(() => prefetchCache.current.delete(key), 60000);
    });
    return promise;
  }, []);

  // Kick off prefetch for upcoming verses
  const prefetchUpcoming = useCallback((startIndex: number, count: number) => {
    const verses = versesRef.current;
    const { ttsSpeed, ttsOnlineVoice } = useSettingsStore.getState();
    const lang = langRef.current;
    const edgeVoice = ttsOnlineVoice || EDGE_DEFAULT_VOICE[lang] || EDGE_DEFAULT_VOICE.en;

    for (let i = startIndex; i < Math.min(startIndex + count, verses.length); i++) {
      prefetchEdge(verses[i].text, edgeVoice, ttsSpeed);
    }
  }, [prefetchEdge]);

  // Speak verse using Edge TTS (with prefetch buffer)
  const speakEdge = useCallback(async (text: string, lang: string, rate: number, voice: string): Promise<void> => {
    const edgeVoice = voice || EDGE_DEFAULT_VOICE[lang] || EDGE_DEFAULT_VOICE.en;

    const audioData = await prefetchEdge(text, edgeVoice, rate);
    const blob = new Blob([audioData], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    return new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        reject(new Error("Audio playback error"));
      };
      audio.playbackRate = 1.0;
      audio.play().catch(reject);
    });
  }, [prefetchEdge]);

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

    const { ttsSpeed, ttsVoiceName, ttsOnline, ttsOnlineVoice } = useSettingsStore.getState();
    const lang = langRef.current;

    if (ttsOnline) {
      // Prefetch next 2 verses while current one plays
      prefetchUpcoming(index + 1, 2);
      // Edge TTS (online high-quality)
      speakEdge(verses[index].text, lang, ttsSpeed, ttsOnlineVoice)
        .then(() => {
          if (!stoppedRef.current) {
            speakVerseRef.current?.(index + 1);
          }
        })
        .catch((err) => {
          // Fallback to device TTS on error
          console.warn("[TTS] Edge TTS failed, falling back to device TTS", err);
          if (stoppedRef.current) return;
          if (isAndroid) {
            nativeSpeak(verses[index].text, lang || undefined, ttsSpeed, ttsVoiceName || undefined)
              .then(() => {
                if (!stoppedRef.current) speakVerseRef.current?.(index + 1);
              })
              .catch(() => {
                setIsPlaying(false);
                setIsPaused(false);
              });
          } else {
            speakDeviceTTS(verses[index].text, lang, ttsSpeed, ttsVoiceName, () => {
              if (!stoppedRef.current) speakVerseRef.current?.(index + 1);
            });
          }
        });
    } else if (isAndroid) {
      nativeSpeak(verses[index].text, lang || undefined, ttsSpeed, ttsVoiceName || undefined)
        .then(() => {
          if (!stoppedRef.current) speakVerseRef.current?.(index + 1);
        })
        .catch(() => {
          setIsPlaying(false);
          setIsPaused(false);
        });
    } else {
      speakDeviceTTS(verses[index].text, lang, ttsSpeed, ttsVoiceName, () => {
        if (!stoppedRef.current) speakVerseRef.current?.(index + 1);
      });
    }
  };

  // Device TTS (Web Speech API)
  const speakDeviceTTS = (text: string, lang: string, speed: number, voiceName: string, onEnd: () => void) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    if (lang) utterance.lang = lang;

    const voices = voicesRef.current;
    if (voiceName) {
      const voice = voices.find((v) => v.name === voiceName);
      if (voice) utterance.voice = voice;
    } else if (lang) {
      const voice = findVoiceForLang(voices, lang);
      if (voice) utterance.voice = voice;
    }

    utterance.onend = onEnd;
    utterance.onerror = (e) => {
      if (e.error !== "interrupted" && e.error !== "canceled") {
        setIsPlaying(false);
        setIsPaused(false);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const play = useCallback(async (verses: Verse[], lang = "", startIndex = 0) => {
    stoppedRef.current = true;
    const mySession = ++sessionIdRef.current;
    stopEdgeAudio();
    prefetchCache.current.clear();
    if (isAndroid) {
      await nativeStop();
    } else if (hasWebTTS) {
      window.speechSynthesis.cancel();
    }

    await new Promise((r) => setTimeout(r, 50));

    // If another play() was called during the wait, abort this one
    if (mySession !== sessionIdRef.current) return;

    versesRef.current = verses;
    langRef.current = lang;
    stoppedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);

    const { ttsOnline } = useSettingsStore.getState();

    if (ttsOnline || isAndroid) {
      speakVerseRef.current?.(startIndex);
    } else {
      ensureVoicesLoaded().then((v) => {
        voicesRef.current = v;
        if (!stoppedRef.current && mySession === sessionIdRef.current) {
          speakVerseRef.current?.(startIndex);
        }
      });
    }
  }, [stopEdgeAudio]);

  const pause = useCallback(() => {
    const { ttsOnline } = useSettingsStore.getState();
    if (ttsOnline && audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
    } else if (isAndroid) {
      stoppedRef.current = true;
      nativeStop();
      setIsPaused(true);
    } else if (hasWebTTS && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    const { ttsOnline } = useSettingsStore.getState();
    if (ttsOnline && audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
    } else if (isAndroid) {
      stoppedRef.current = false;
      setIsPaused(false);
      speakVerseRef.current?.(currentVerseIndex);
    } else if (hasWebTTS && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [currentVerseIndex]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    stopEdgeAudio();
    prefetchCache.current.clear();
    if (isAndroid) {
      nativeStop();
    } else if (hasWebTTS) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentVerseIndex(0);
  }, [stopEdgeAudio]);

  const getAvailableVoices = useCallback(() => {
    return voicesRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      stopEdgeAudio();
      if (isAndroid) {
        nativeStop();
      } else if (hasWebTTS) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopEdgeAudio]);

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
