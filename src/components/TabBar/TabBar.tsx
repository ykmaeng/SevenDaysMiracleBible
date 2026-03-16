import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore } from "../../stores/tabStore";
import { getDownloadedTranslations } from "../../lib/bible";
import type { Translation } from "../../types/bible";

export function TabBar() {
  const { t } = useTranslation();
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, togglePin, reorderTab } = useTabStore();
  const [translations, setTranslations] = useState<Translation[]>([]);

  // DnD state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const dragStartX = useRef(0);
  const dragIdx = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressReady = useRef(false);
  const justDragged = useRef(false);
  const swapCooldown = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const pointerStartX = useRef(0);
  const scrollStartX = useRef(0);

  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  useEffect(() => {
    const load = () => getDownloadedTranslations().then(setTranslations);
    load();
    window.addEventListener("translations-changed", load);
    return () => window.removeEventListener("translations-changed", load);
  }, []);

  const canDrop = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return false;
    return !!tabs[fromIdx]?.pinned === !!tabs[toIdx]?.pinned;
  }, [tabs]);

  const snapshotPositions = useCallback(() => {
    const rects = new Map<string, DOMRect>();
    for (const [id, el] of tabRefMap.current) {
      rects.set(id, el.getBoundingClientRect());
    }
    prevRectsRef.current = rects;
  }, []);

  // FLIP animation after reorder
  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    if (prev.size === 0) return;
    prevRectsRef.current = new Map();
    if (dragIdx.current === null) return;

    const dragTabId = tabs[dragIdx.current]?.id;
    for (const [id, el] of tabRefMap.current) {
      if (id === dragTabId) continue;
      const oldRect = prev.get(id);
      if (!oldRect) continue;
      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      if (Math.abs(dx) < 1) continue;
      el.animate(
        [
          { transform: `translateX(${dx}px)` },
          { transform: "translateX(0)" },
        ],
        { duration: 200, easing: "ease-out" }
      );
    }
  }, [tabIds]);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if ((e.target as HTMLElement).closest("button")) return;
    pointerStartX.current = e.clientX;
    scrollStartX.current = scrollContainerRef.current?.scrollLeft ?? 0;
    longPressReady.current = false;

    const cancelLongPress = () => {
      clearLongPress();
      document.removeEventListener("pointermove", onEarlyMove);
      document.removeEventListener("pointerup", cancelLongPress);
    };
    const onEarlyMove = (ev: PointerEvent) => {
      const dx = ev.clientX - pointerStartX.current;
      if (Math.abs(dx) > 5) {
        cancelLongPress();
        // Scroll the tab bar instead
        if (scrollContainerRef.current) {
          const onScrollMove = (sev: PointerEvent) => {
            const sdx = sev.clientX - pointerStartX.current;
            scrollContainerRef.current!.scrollLeft = scrollStartX.current - sdx;
          };
          const onScrollUp = () => {
            document.removeEventListener("pointermove", onScrollMove);
            document.removeEventListener("pointerup", onScrollUp);
          };
          document.addEventListener("pointermove", onScrollMove);
          document.addEventListener("pointerup", onScrollUp);
        }
      }
    };

    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      document.removeEventListener("pointermove", onEarlyMove);
      document.removeEventListener("pointerup", cancelLongPress);

      longPressReady.current = true;
      dragIdx.current = index;
      dragStartX.current = pointerStartX.current;
      setDragIndex(index);
      setDragOffsetX(0);
      navigator.vibrate?.(30);

      const onMove = (ev: PointerEvent) => {
        if (dragIdx.current === null) return;
        ev.preventDefault();
        setDragOffsetX(ev.clientX - dragStartX.current);

        if (swapCooldown.current) return;

        const currentTabs = useTabStore.getState().tabs;
        for (const [id, el] of tabRefMap.current.entries()) {
          const tabIdx = currentTabs.findIndex((t) => t.id === id);
          if (tabIdx < 0 || tabIdx === dragIdx.current) continue;
          const rect = el.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const atCenter = Math.abs(ev.clientX - center) < rect.width * 0.3;
          if (atCenter && canDrop(dragIdx.current, tabIdx)) {
            snapshotPositions();
            reorderTab(dragIdx.current, tabIdx);
            dragStartX.current = ev.clientX;
            setDragOffsetX(0);
            dragIdx.current = tabIdx;
            setDragIndex(tabIdx);
            navigator.vibrate?.(15);
            swapCooldown.current = true;
            setTimeout(() => { swapCooldown.current = false; }, 250);
            break;
          }
        }
      };

      const onUp = () => {
        dragIdx.current = null;
        longPressReady.current = false;
        setDragIndex(null);
        setDragOffsetX(0);
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 300);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }, 400);

    document.addEventListener("pointermove", onEarlyMove);
    document.addEventListener("pointerup", cancelLongPress);
  };

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div ref={scrollContainerRef} className="flex items-center overflow-x-hidden flex-1 min-w-0">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            data-tab
            ref={(el) => { if (el) tabRefMap.current.set(tab.id, el); else tabRefMap.current.delete(tab.id); }}
            onPointerDown={(e) => handlePointerDown(e, index)}
            className={`group flex items-center gap-1 py-2 text-sm border-r border-gray-200 dark:border-gray-700 min-w-0 shrink-0 select-none touch-none ${
              dragIndex !== null ? "cursor-grabbing" : "cursor-grab"
            } ${
              tab.id === activeTabId
                ? "bg-white dark:bg-gray-900 text-blue-600 font-medium"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            } ${dragIndex === index ? "z-10 relative" : ""} px-3`}
            style={dragIndex === index ? { transform: `translateX(${dragOffsetX}px) scale(1.05)`, opacity: 0.8 } : undefined}
            onClick={() => {
              if (!justDragged.current) setActiveTab(tab.id);
            }}
            onDoubleClick={() => {
              if (!justDragged.current) togglePin(tab.id);
            }}
            title={tab.pinned ? t("tabs.unpin") : t("tabs.pin")}
          >
            <span className="truncate max-w-[140px] pointer-events-none">
              {(() => {
                const tr = translations.find((x) => x.id === tab.translationId);
                const lang = tr?.language;
                const bookName = lang ? t(`books.${tab.bookId}`, { lng: lang }) : t(`books.${tab.bookId}`);
                return `${bookName} ${tab.chapter}`;
              })()}
            </span>
            {tab.pinned ? (
              <svg className="w-3 h-3 text-blue-500 shrink-0 ml-1" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 01-.5.5H8.5v5.5a.5.5 0 01-1 0V10H3.5a.5.5 0 01-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 015 6.708V2.277a2.77 2.77 0 01-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 01.146-.354z" />
              </svg>
            ) : tabs.length > 1 && tab.id === activeTabId ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="text-gray-400 hover:text-red-500 ml-1 shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
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

    </div>
  );
}
