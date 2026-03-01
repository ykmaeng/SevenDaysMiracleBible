import { useState, useCallback, useRef } from "react";
import type { DictionaryEntry } from "../lib/dictionaryService";
import { lookupOffline, lookupOnline, translateDefinitions, lookupViaTranslate, ensureDictionaryTable } from "../lib/dictionaryService";

// Cache by word+sourceLang+targetLang
const cache = new Map<string, DictionaryEntry>();
let tableEnsured = false;

function normalizeWord(raw: string): string {
  // Strip leading/trailing non-letter characters but keep internal ones (hyphens, apostrophes, non-latin chars)
  return raw.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

function cacheKey(word: string, sourceLang: string, targetLang: string): string {
  return `${word}:${sourceLang}:${targetLang}`;
}

export function useDictionary(targetLang: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeWord = useRef<string>("");

  const lookup = useCallback(async (raw: string, sourceLang: string) => {
    const word = normalizeWord(raw);
    if (!word) return;

    activeWord.current = word;
    setError(null);
    setResult(null);

    // Check memory cache
    const key = cacheKey(word, sourceLang, targetLang);
    const cached = cache.get(key);
    if (cached) {
      setResult(cached);
      return;
    }

    setLoading(true);
    try {
      let entry: DictionaryEntry | null = null;

      if (sourceLang === "en") {
        // English word: use dictionary API (offline → online) then translate definitions
        if (!tableEnsured) {
          try {
            await ensureDictionaryTable();
            tableEnsured = true;
          } catch {
            // Table creation failed, skip offline
          }
        }

        if (tableEnsured) {
          entry = await lookupOffline(word);
        }
        if (!entry) {
          entry = await lookupOnline(word);
        }

        if (activeWord.current !== word) return;

        if (entry && targetLang !== "en") {
          try {
            entry = await translateDefinitions(entry, "en", targetLang);
          } catch {
            // Translation failed — show English definitions
          }
        }
      } else {
        // Non-English word: use Google Translate as dictionary
        entry = await lookupViaTranslate(word, sourceLang, targetLang);
      }

      if (activeWord.current !== word) return;

      if (!entry) {
        setError("noResult");
        return;
      }

      cache.set(key, entry);
      setResult(entry);
    } catch {
      if (activeWord.current === word) {
        setError("error");
      }
    } finally {
      if (activeWord.current === word) {
        setLoading(false);
      }
    }
  }, [targetLang]);

  const clear = useCallback(() => {
    activeWord.current = "";
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { loading, result, error, lookup, clear };
}
