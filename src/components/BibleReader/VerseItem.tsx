import { useSettingsStore } from "../../stores/settingsStore";
import type { Verse } from "../../types/bible";

interface VerseItemProps {
  verse: Verse;
  parallelVerses?: { translationId: string; translationName: string; text: string }[];
  isPlaying?: boolean;
}

export function VerseItem({ verse, parallelVerses, isPlaying }: VerseItemProps) {
  const showVerseNumbers = useSettingsStore((s) => s.showVerseNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);

  return (
    <div
      className={`rounded px-0.5 py-0.5 transition-colors ${
        isPlaying
          ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-700"
          : ""
      }`}
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
    >
      <div className="flex">
        {showVerseNumbers && (
          <span className="text-gray-400 dark:text-gray-500 font-medium mr-2 shrink-0 select-none" style={{ fontSize: '0.8em', minWidth: '1.5em', textAlign: 'right' }}>{verse.verse}</span>
        )}
        <span className="flex-1">{verse.text}</span>
      </div>
      {parallelVerses && parallelVerses.length > 0 && (
        <div className="ml-6 mt-0.5 space-y-0.5">
          {parallelVerses.map((pv) => (
            <div key={pv.translationId} className="flex items-baseline gap-1.5" style={{ fontSize: `${Math.max(12, fontSize - 2)}px`, lineHeight: 1.6 }}>
              <span className="text-blue-500 dark:text-blue-400 font-medium shrink-0 text-[0.7em] uppercase">{pv.translationId}</span>
              <span className="text-gray-500 dark:text-gray-400">{pv.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
