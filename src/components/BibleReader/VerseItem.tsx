import { useSettingsStore } from "../../stores/settingsStore";
import type { Verse } from "../../types/bible";

interface VerseItemProps {
  verse: Verse;
  isSelected: boolean;
  onSelect: (verse: number) => void;
}

export function VerseItem({ verse, isSelected, onSelect }: VerseItemProps) {
  const showVerseNumbers = useSettingsStore((s) => s.showVerseNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);

  return (
    <div
      className={`flex cursor-pointer transition-colors rounded px-0.5 ${
        isSelected ? "bg-amber-100" : "hover:bg-gray-50"
      }`}
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
      onClick={() => onSelect(verse.verse)}
    >
      {showVerseNumbers && (
        <span className="text-gray-400 font-medium mr-2 shrink-0 select-none" style={{ fontSize: '0.8em', minWidth: '1.5em', textAlign: 'right' }}>{verse.verse}</span>
      )}
      <span className="flex-1">{verse.text}</span>
    </div>
  );
}
