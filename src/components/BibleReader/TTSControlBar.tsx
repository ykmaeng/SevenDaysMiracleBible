import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

interface TTSControlBarProps {
  isPaused: boolean;
  currentVerseNumber: number;
  speed: number;
  voiceName: string;
  lang: string;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onVoiceChange: (name: string) => void;
}

const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function TTSControlBar({
  isPaused,
  currentVerseNumber,
  speed,
  voiceName,
  lang,
  onPause,
  onResume,
  onStop,
  onSpeedChange,
  onVoiceChange,
}: TTSControlBarProps) {
  const { t } = useTranslation();
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Filter voices relevant to the current language, then show all others
  const { matchingVoices, otherVoices } = useMemo(() => {
    if (!lang)
      return { matchingVoices: voices, otherVoices: [] as SpeechSynthesisVoice[] };
    const matching = voices.filter((v) => v.lang.startsWith(lang));
    const other = voices.filter((v) => !v.lang.startsWith(lang));
    return { matchingVoices: matching, otherVoices: other };
  }, [voices, lang]);

  const currentVoice = voices.find((v) => v.name === voiceName);
  const autoVoice = !voiceName && lang
    ? voices.find((v) => v.lang.startsWith(lang + "-")) ?? voices.find((v) => v.lang === lang)
    : null;
  const displayName = currentVoice
    ? currentVoice.name.replace(/\s*\(.*\)$/, "")
    : autoVoice
      ? `Auto (${autoVoice.name.replace(/\s*\(.*\)$/, "")})`
      : "Auto";

  const cycleSpeed = () => {
    const currentIdx = SPEED_STEPS.indexOf(speed);
    const nextIdx = (currentIdx + 1) % SPEED_STEPS.length;
    onSpeedChange(SPEED_STEPS[nextIdx]);
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-600">
        {/* Verse indicator */}
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[24px] text-center">
          {currentVerseNumber}
        </span>

        {/* Play/Pause */}
        <button
          onClick={isPaused ? onResume : onPause}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          title={isPaused ? t("tts.play") : t("tts.pause")}
        >
          {isPaused ? (
            <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          )}
        </button>

        {/* Stop */}
        <button
          onClick={onStop}
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={t("tts.stop")}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />

        {/* Voice picker toggle */}
        <button
          onClick={() => setShowVoicePicker(!showVoicePicker)}
          className={`text-xs font-medium px-2 py-1 rounded-full max-w-[160px] truncate transition-colors ${
            showVoicePicker
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          title={t("tts.voice")}
        >
          {displayName}
        </button>

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 min-w-[36px] transition-colors"
          title={t("tts.speed")}
        >
          {speed}x
        </button>
      </div>

      {/* Voice picker dropdown */}
      {showVoicePicker && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-64 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1">
          <button
            onClick={() => {
              onVoiceChange("");
              setShowVoicePicker(false);
            }}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${
              !voiceName
                ? "text-blue-600 dark:text-blue-400 font-medium"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            Auto
          </button>

          {matchingVoices.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase border-t border-gray-100 dark:border-gray-700 mt-1">
                {lang.toUpperCase()}
              </div>
              {matchingVoices.map((v) => (
                <button
                  key={v.name}
                  onClick={() => {
                    onVoiceChange(v.name);
                    setShowVoicePicker(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    voiceName === v.name
                      ? "text-blue-600 dark:text-blue-400 font-medium"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </>
          )}

          {otherVoices.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase border-t border-gray-100 dark:border-gray-700 mt-1">
                {t("tts.voice")}
              </div>
              {otherVoices.map((v) => (
                <button
                  key={v.name}
                  onClick={() => {
                    onVoiceChange(v.name);
                    setShowVoicePicker(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    voiceName === v.name
                      ? "text-blue-600 dark:text-blue-400 font-medium"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span>{v.name}</span>
                  <span className="ml-1 text-gray-400 dark:text-gray-500">
                    {v.lang}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
