import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, type CommentaryPosition } from "../../stores/settingsStore";
import { useFeatureStore } from "../../stores/featureStore";
import type { TTSVoice } from "../../hooks/useTTS";

interface ReaderSettingsDropdownProps {
  showCommentary: boolean;
  onToggleCommentary: () => void;
  showInterlinear: boolean;
  onToggleInterlinear: () => void;
  voices: TTSVoice[];
}

export function ReaderSettingsDropdown({
  showCommentary,
  onToggleCommentary,
  showInterlinear,
  onToggleInterlinear,
  voices: ttsVoices,
}: ReaderSettingsDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const showParallelInline = useSettingsStore((s) => s.showParallelInline);
  const setShowParallelInline = useSettingsStore((s) => s.setShowParallelInline);
  const showVerseNumbers = useSettingsStore((s) => s.showVerseNumbers);
  const setShowVerseNumbers = useSettingsStore((s) => s.setShowVerseNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const commentaryPosition = useSettingsStore((s) => s.commentaryPosition);
  const setCommentaryPosition = useSettingsStore((s) => s.setCommentaryPosition);
  const showDictionary = useSettingsStore((s) => s.showDictionary);
  const setShowDictionary = useSettingsStore((s) => s.setShowDictionary);
  const ttsVoiceName = useSettingsStore((s) => s.ttsVoiceName);
  const setTtsVoiceName = useSettingsStore((s) => s.setTtsVoiceName);
  const ttsSpeed = useSettingsStore((s) => s.ttsSpeed);
  const setTtsSpeed = useSettingsStore((s) => s.setTtsSpeed);
  const isCommentaryEnabled = useFeatureStore((s) => s.isEnabled("commentary"));
  const isInterlinearEnabled = useFeatureStore((s) => s.isEnabled("interlinear"));
  const isDictionaryEnabled = useFeatureStore((s) => s.isEnabled("dictionary"));

  const groupedVoices = useMemo(() => {
    const map = new Map<string, TTSVoice[]>();
    for (const v of ttsVoices) {
      if (v.name.includes("Eloquence")) continue;
      const lang = v.lang.split("-")[0];
      if (!map.has(lang)) map.set(lang, []);
      map.get(lang)!.push(v);
    }
    return map;
  }, [ttsVoices]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`p-1.5 rounded ${
          open ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
        title={t("reader.readerSettings")}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          {/* Parallel View toggle */}
          <ToggleItem
            label={t("reader.parallelView")}
            checked={showParallelInline}
            onChange={setShowParallelInline}
          />

          {/* AI Commentary toggle */}
          {isCommentaryEnabled && (
            <ToggleItem
              label={t("commentary.title")}
              checked={showCommentary}
              onChange={onToggleCommentary}
            />
          )}

          {/* Commentary position selector (submenu, visible when commentary is on) */}
          {isCommentaryEnabled && showCommentary && (
            <div className="flex items-center justify-between pl-7 pr-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">{t("commentary.position")}</span>
              <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
                {(["left", "bottom", "right"] as CommentaryPosition[]).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setCommentaryPosition(pos)}
                    className={`p-1 rounded ${
                      commentaryPosition === pos
                        ? "bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                    title={t(`commentary.${pos}`)}
                  >
                    {pos === "left" && (
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="1" y="1" width="5" height="14" rx="1" />
                        <rect x="7" y="1" width="8" height="14" rx="1" opacity="0.3" />
                      </svg>
                    )}
                    {pos === "bottom" && (
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="1" y="9" width="14" height="6" rx="1" />
                        <rect x="1" y="1" width="14" height="7" rx="1" opacity="0.3" />
                      </svg>
                    )}
                    {pos === "right" && (
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="1" y="1" width="8" height="14" rx="1" opacity="0.3" />
                        <rect x="10" y="1" width="5" height="14" rx="1" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interlinear toggle */}
          {isInterlinearEnabled && (
            <ToggleItem
              label={t("interlinear.title")}
              checked={showInterlinear}
              onChange={onToggleInterlinear}
            />
          )}

          {/* Dictionary toggle */}
          {isDictionaryEnabled && (
            <ToggleItem
              label={t("reader.showDictionary")}
              checked={showDictionary}
              onChange={setShowDictionary}
            />
          )}

          {/* Verse Numbers toggle */}
          <ToggleItem
            label={t("settings.showVerseNumbers")}
            checked={showVerseNumbers}
            onChange={setShowVerseNumbers}
          />

          {/* Font Size control */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
            <span className="text-sm text-gray-700 dark:text-gray-300">{t("settings.fontSize")}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFontSize(fontSize - 1)}
                className="w-7 h-7 flex items-center justify-center rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-bold"
              >
                A-
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400 w-6 text-center">{fontSize}</span>
              <button
                onClick={() => setFontSize(fontSize + 1)}
                className="w-7 h-7 flex items-center justify-center rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-bold"
              >
                A+
              </button>
            </div>
          </div>

          {/* TTS section divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <div className="px-3 py-1">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">{t("tts.title")}</span>
          </div>

          {/* TTS Voice selector */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
            <span className="text-sm text-gray-700 dark:text-gray-300 shrink-0">{t("tts.voice")}</span>
            <select
              value={ttsVoiceName}
              onChange={(e) => setTtsVoiceName(e.target.value)}
              className="ml-2 max-w-[140px] text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded px-2 py-1.5 border-none outline-none"
            >
              <option value="">{t("tts.systemDefault")}</option>
              {[...groupedVoices.entries()].map(([lang, langVoices]) => (
                <optgroup key={lang} label={lang.toUpperCase()}>
                  {langVoices.map((v, i) => (
                    <option key={`${lang}-${i}`} value={v.name}>
                      {v.name.replace(/\s*\(.*\)$/, "").replace(/^Google\s+/, "")}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* TTS Speed slider */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
            <span className="text-sm text-gray-700 dark:text-gray-300">{t("tts.speed")}</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.25"
                value={ttsSpeed}
                onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                className="w-20 h-1 accent-blue-500"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{ttsSpeed}x</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
      onClick={() => onChange(!checked)}
    >
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <div
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}
