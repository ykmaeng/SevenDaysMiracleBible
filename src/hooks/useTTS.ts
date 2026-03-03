import { useState, useCallback, useRef, useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import type { Verse } from "../types/bible";

interface TTSState {
  isAvailable: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentVerseIndex: number;
}

interface TTSActions {
  play: (verses: Verse[], lang?: string, startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  getAvailableVoices: () => SpeechSynthesisVoice[];
}

function isUsableVoice(v: SpeechSynthesisVoice): boolean {
  return !v.name.includes("Eloquence");
}

function findVoiceForLang(
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice | undefined {
  // Try exact prefix match (e.g. "ko" matches "ko-KR")
  return (
    voices.find((v) => isUsableVoice(v) && v.lang.startsWith(lang + "-")) ??
    voices.find((v) => isUsableVoice(v) && v.lang === lang)
  );
}

function checkTTS(): boolean {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    // Verify the API actually works (Android WebView may expose a broken stub)
    window.speechSynthesis.getVoices();
    return true;
  } catch {
    return false;
  }
}

const hasTTS = checkTTS();

function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (!hasTTS) return Promise.resolve([]);
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

export function useTTS(): TTSState & TTSActions {
  const [isAvailable, setIsAvailable] = useState(hasTTS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);

  const versesRef = useRef<Verse[]>([]);
  const langRef = useRef("");
  const stoppedRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const speakVerseRef = useRef<((index: number) => void) | null>(null);

  // Pre-load voices on mount; disable TTS if no voices found (Android WebView)
  useEffect(() => {
    if (!hasTTS) return;
    ensureVoicesLoaded().then((v) => {
      voicesRef.current = v;
      if (v.length === 0) setIsAvailable(false);
    });
    const update = () => {
      const v = window.speechSynthesis.getVoices();
      voicesRef.current = v;
      if (v.length > 0) setIsAvailable(true);
    };
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);

  // speakVerse reads settings directly from the store for always-fresh values
  speakVerseRef.current = (index: number) => {
    const verses = versesRef.current;
    if (index >= verses.length || stoppedRef.current) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentVerseIndex(0);
      return;
    }

    setCurrentVerseIndex(index);

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

    if (hasTTS) window.speechSynthesis.speak(utterance);
  };

  const play = useCallback((verses: Verse[], lang = "", startIndex = 0) => {
    // Stop existing chain before cancel to prevent onend from advancing
    stoppedRef.current = true;
    if (hasTTS) window.speechSynthesis.cancel();
    versesRef.current = verses;
    langRef.current = lang;
    stoppedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);

    // Ensure voices are ready before speaking
    ensureVoicesLoaded().then((v) => {
      voicesRef.current = v;
      if (!stoppedRef.current) {
        speakVerseRef.current?.(startIndex);
      }
    });
  }, []);

  const pause = useCallback(() => {
    if (hasTTS && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (hasTTS && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (hasTTS) window.speechSynthesis.cancel();
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
      if (hasTTS) window.speechSynthesis.cancel();
    };
  }, []);

  return {
    isAvailable,
    isPlaying,
    isPaused,
    currentVerseIndex,
    play,
    pause,
    resume,
    stop,
    getAvailableVoices,
  };
}
