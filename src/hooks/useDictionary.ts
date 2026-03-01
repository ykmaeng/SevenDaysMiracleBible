import { useState, useCallback, useRef } from "react";
import type { DictionaryEntry } from "../lib/dictionaryService";
import { lookupOffline, lookupOnline, translateDefinitions, ensureDictionaryTable } from "../lib/dictionaryService";

// Cache by word+lang so each language gets its own translated result
const cache = new Map<string, DictionaryEntry>();
let tableEnsured = false;

function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z'-]/g, "").replace(/^'+|'+$/g, "");
}

function cacheKey(word: string, lang: string): string {
  return `${word}:${lang}`;
}

export function useDictionary(language: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeWord = useRef<string>("");

  const lookup = useCallback(async (raw: string) => {
    const word = normalizeWord(raw);
    if (!word) return;

    activeWord.current = word;
    setError(null);
    setResult(null);

    // Check memory cache (with language)
    const key = cacheKey(word, language);
    const cached = cache.get(key);
    if (cached) {
      setResult(cached);
      return;
    }

    setLoading(true);
    try {
      // Ensure table exists for offline lookup
      if (!tableEnsured) {
        try {
          await ensureDictionaryTable();
          tableEnsured = true;
        } catch {
          // Table creation failed, skip offline
        }
      }

      let entry: DictionaryEntry | null = null;

      // Try offline first
      if (tableEnsured) {
        entry = await lookupOffline(word);
      }

      // Try online
      if (!entry) {
        entry = await lookupOnline(word);
      }

      if (activeWord.current !== word) return; // stale

      if (!entry) {
        setError("noResult");
        return;
      }

      // Translate definitions to user's language
      if (language !== "en") {
        try {
          entry = await translateDefinitions(entry, language);
        } catch {
          // Translation failed — show English definitions
        }
      }

      if (activeWord.current !== word) return; // stale

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
  }, [language]);

  const clear = useCallback(() => {
    activeWord.current = "";
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { loading, result, error, lookup, clear };
}
