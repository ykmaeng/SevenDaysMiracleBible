import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore } from "../../stores/tabStore";
import { getDownloadedTranslations } from "../../lib/bible";
import type { Translation } from "../../types/bible";

export function TabBar() {
  const { t } = useTranslation();
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, updateTab, togglePin, reorderTab } = useTabStore();
  const [showTranslationPicker, setShowTranslationPicker] = useState(false);
  const [translations, setTranslations] = useState<Translation[]>([]);

  // DnD state (long-press + pointer-based)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const isDragging = useRef(false);
  const longPressReady = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartX = useRef(0);
  const scrollStartX = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  useEffect(() => {
    const load = () => getDownloadedTranslations().then(setTranslations);
    load();
    window.addEventListener("translations-changed", load);
    return () => window.removeEventListener("translations-changed", load);
  }, []);

  const canDrop = useCallback((from: number, to: number) => {
    if (from === to) return false;
    return !!tabs[from]?.pinned === !!tabs[to]?.pinned;
  }, [tabs]);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if ((e.target as HTMLElement).closest("button")) return;
    longPressReady.current = false;
    isDragging.current = false;
    pointerStartX.current = e.clientX;
    scrollStartX.current = scrollContainerRef.current?.scrollLeft ?? 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressReady.current = true;
      setDragIndex(index);
    }, 400);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - pointerStartX.current;

    // Long press not yet fired → scroll the tab bar
    if (!longPressReady.current) {
      if (Math.abs(dx) > 3) clearLongPress(); // cancel long press on move
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollStartX.current - dx;
      }
      return;
    }

    // Long press fired → DnD mode
    if (dragIndex === null) return;
    isDragging.current = true;

    const x = e.clientX;
    for (let i = 0; i < tabRefs.current.length; i++) {
      const el = tabRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right) {
        if (canDrop(dragIndex, i)) {
          setDropIndex(i);
        } else {
          setDropIndex(null);
        }
        return;
      }
    }
    setDropIndex(null);
  }, [dragIndex, canDrop]);

  const handlePointerUp = useCallback(() => {
    clearLongPress();
    if (dragIndex !== null && dropIndex !== null && isDragging.current) {
      reorderTab(dragIndex, dropIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
    isDragging.current = false;
    longPressReady.current = false;
  }, [dragIndex, dropIndex, reorderTab]);

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div ref={scrollContainerRef} className="flex items-center overflow-x-hidden flex-1 min-w-0">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            data-tab
            ref={(el) => { tabRefs.current[index] = el; }}
            onPointerDown={(e) => handlePointerDown(e, index)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`group flex items-center gap-1 py-2 text-sm border-r border-gray-200 dark:border-gray-700 min-w-0 shrink-0 select-none touch-none ${
              dragIndex !== null ? "cursor-grabbing" : "cursor-grab"
            } ${
              dragIndex === index && isDragging.current ? "opacity-40" : ""
            } ${
              tab.id === activeTabId
                ? "bg-white dark:bg-gray-900 text-blue-600 font-medium"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            } ${dropIndex === index ? "pl-1 pr-3 border-l-2 border-l-blue-500" : "px-3"}`}
            onClick={() => {
              if (!isDragging.current) setActiveTab(tab.id);
            }}
          >
            <span className="truncate max-w-[140px] pointer-events-none">
              {t(`books.${tab.bookId}`)} {tab.chapter}
              <span className="text-[10px] text-gray-400 ml-1 uppercase">{tab.translationId}</span>
            </span>
            <div className="flex items-center shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(tab.id);
                }}
                className={`ml-1 ${
                  tab.pinned
                    ? "text-blue-500 hover:text-blue-700"
                    : "text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100"
                } transition-opacity`}
                title={tab.pinned ? t("tabs.unpin") : t("tabs.pin")}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 01-.5.5H8.5v5.5a.5.5 0 01-1 0V10H3.5a.5.5 0 01-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 015 6.708V2.277a2.77 2.77 0 01-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 01.146-.354z" />
                </svg>
              </button>
              {!tab.pinned && tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
        <button
            onClick={() => addTab()}
            className="px-3 py-2 text-gray-400 hover:text-blue-600 shrink-0"
            title={t("tabs.newTab")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
      </div>

      {/* Translation selector */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowTranslationPicker(!showTranslationPicker)}
          className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700 uppercase"
        >
          {activeTab?.translationId ?? "kjv"}
        </button>
        {showTranslationPicker && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowTranslationPicker(false)}
            />
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 min-w-[220px] py-1">
              {translations.map((tr) => (
                <button
                  key={tr.id}
                  onClick={() => {
                    updateTab(activeTabId, { translationId: tr.id });
                    setShowTranslationPicker(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${
                    activeTab?.translationId === tr.id
                      ? "text-blue-600 font-medium bg-blue-50 dark:bg-blue-900/30"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span>{tr.name}</span>
                  <span className="text-xs text-gray-400 uppercase">{tr.language}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
