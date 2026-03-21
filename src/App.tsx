import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { TabBar } from "./components/TabBar/TabBar";
import { TabPanel } from "./components/TabBar/TabPanel";
import { ToastContainer } from "./components/Toast";
import { LanguageSettings } from "./components/Settings/LanguageSettings";
import { LanguageOnboarding } from "./components/Onboarding/LanguageOnboarding";
import { SplashScreen } from "./components/Splash/SplashScreen";
import { GuidedTips } from "./components/Onboarding/GuidedTips";
import { FeaturesView } from "./components/Features/FeaturesView";
import { BookmarksView } from "./components/Bookmarks/BookmarksView";
import { HighlightsView } from "./components/Highlights/HighlightsView";
import { NotesView } from "./components/Notes/NotesView";
import { SearchView } from "./components/Search/SearchView";
import { useSettingsStore } from "./stores/settingsStore";
import { useFeatureStore, FEATURE_REGISTRY } from "./stores/featureStore";
import { useTabStore } from "./stores/tabStore";
import { loadGoogleFont } from "./lib/googleFonts";
import { fetchAnnouncements, hasNewAnnouncement } from "./lib/announcements";

type View = "reader" | "settings" | "features" | "bookmarks" | "highlights" | "notes" | "search";

function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<View>("reader");
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const [showSplash, setShowSplash] = useState(() => onboardingComplete);
  const [immersive, setImmersive] = useState(false);
  const immersiveRef = useRef(false);
  const lastBackRef = useRef(0);
  const theme = useSettingsStore((s) => s.theme);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const enabledFeatures = useFeatureStore((s) => s.enabledFeatures);
  const navigateTo = useTabStore((s) => s.navigateTo);
  const updateTab = useTabStore((s) => s.updateTab);
  const activeTabId = useTabStore((s) => s.activeTabId);

  const [hasNewNotice, setHasNewNotice] = useState(false);

  useEffect(() => {
    fetchAnnouncements(i18n.language).then((data) => {
      setHasNewNotice(hasNewAnnouncement(data));
    });
  }, []);

  // Clear badge when entering settings
  useEffect(() => {
    if (view === "settings") setHasNewNotice(false);
  }, [view]);

  const featureOrder = useFeatureStore((s) => s.featureOrder);
  const tabBarFeatures = (() => {
    const allIds = new Set(FEATURE_REGISTRY.map((f) => f.id));
    const order = featureOrder.filter((id) => allIds.has(id));
    for (const f of FEATURE_REGISTRY) {
      if (!order.includes(f.id)) order.push(f.id);
    }
    return order
      .map((id) => FEATURE_REGISTRY.find((f) => f.id === id)!)
      .filter((f) => f && f.showInTabBar && enabledFeatures.includes(f.id));
  })();

  // Listen for open-settings/open-search events
  useEffect(() => {
    const settingsHandler = () => setView("settings");
    const searchHandler = () => setView("search");
    window.addEventListener("open-settings", settingsHandler);
    window.addEventListener("open-search", searchHandler);
    return () => {
      window.removeEventListener("open-settings", settingsHandler);
      window.removeEventListener("open-search", searchHandler);
    };
  }, []);


  // Android back button
  useEffect(() => {
    const handler = () => {
      // 1. Close popups/sub-toolbars
      const evt = new CustomEvent("dismiss-popup", { detail: { handled: false } });
      window.dispatchEvent(evt);
      if (evt.detail.handled) {
        history.pushState(null, "", "");
        return;
      }
      // 2. Exit immersive mode
      if (immersiveRef.current) {
        window.dispatchEvent(new CustomEvent("reader-fullscreen", { detail: false }));
        history.pushState(null, "", "");
        return;
      }
      // 3. Close non-reader views
      if (view !== "reader") {
        setView("reader");
        history.pushState(null, "", "");
        return;
      }
      // 4. Reader + toolbar visible — double-back to exit
      const now = Date.now();
      if (now - lastBackRef.current < 2000) return;
      lastBackRef.current = now;
      history.pushState(null, "", "");
    };
    history.pushState(null, "", "");
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [view]);

  // Immersive reading mode
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const fullscreen = detail === "toggle" ? !immersiveRef.current : !!detail;
      setImmersive(fullscreen);
      immersiveRef.current = fullscreen;
      try {
        (window as unknown as { AndroidImmersive?: { setImmersive: (v: boolean) => void } })
          .AndroidImmersive?.setImmersive(fullscreen);
      } catch { /* not on Android */ }
    };
    window.addEventListener("reader-fullscreen", handler);
    return () => window.removeEventListener("reader-fullscreen", handler);
  }, []);

  // Load selected Google Font on startup
  useEffect(() => {
    if (fontFamily) {
      // Extract the font name from CSS value like "'Noto Sans KR', sans-serif"
      const match = fontFamily.match(/^'([^']+)'/);
      if (match) loadGoogleFont(match[1]);
    }
  }, [fontFamily]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () => mq.matches ? root.classList.add("dark") : root.classList.remove("dark");
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
  }, [theme]);

  const dismissSplash = useCallback(() => setShowSplash(false), []);

  if (!onboardingComplete) {
    return (
      <div className="h-screen bg-white dark:bg-gray-900 dark:text-gray-100" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <LanguageOnboarding />
      </div>
    );
  }

  return (
    <>
      {showSplash && <SplashScreen onDone={dismissSplash} />}
      {!showSplash && <GuidedTips />}
    <div
      className="flex flex-col h-screen bg-white dark:bg-gray-900 dark:text-gray-100"
      style={{
        paddingTop: immersive ? 0 : "env(safe-area-inset-top, 0px)",
        paddingBottom: immersive ? 0 : "env(safe-area-inset-bottom, 0px)",
        transition: "padding 150ms ease-out",
      }}
    >
      {/* Tab bar */}
      {view === "reader" && enabledFeatures.includes("tabs") && (
        <div className={`transition-all duration-150 ease-out overflow-hidden ${immersive ? "max-h-0" : "max-h-14"}`}>
          <TabBar />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden" data-tip-target="reader-area">
        {view === "reader" && <TabPanel immersive={immersive} />}
        {view === "settings" && (
          <div className="h-full overflow-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("settings.title")}</h2>
              <button
                onClick={() => setView("reader")}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <LanguageSettings />
            </div>
          </div>
        )}
        {view === "features" && <FeaturesView onClose={() => setView("reader")} />}
        {view === "bookmarks" && (
          <BookmarksView
            onClose={() => setView("reader")}
            onNavigate={(bookId, chapter, verse) => {
              navigateTo(bookId, chapter, verse);
              setView("reader");
              setTimeout(() => updateTab(activeTabId, { verse: undefined }), 4000);
            }}
          />
        )}
        {view === "highlights" && (
          <HighlightsView
            onClose={() => setView("reader")}
            onNavigate={(bookId, chapter, verse) => {
              navigateTo(bookId, chapter, verse);
              setView("reader");
              setTimeout(() => updateTab(activeTabId, { verse: undefined }), 4000);
            }}
          />
        )}
        {view === "notes" && (
          <NotesView
            onClose={() => setView("reader")}
            onNavigate={(bookId, chapter, verse) => {
              navigateTo(bookId, chapter, verse);
              setView("reader");
              setTimeout(() => updateTab(activeTabId, { verse: undefined }), 4000);
            }}
          />
        )}
        {view === "search" && (
          <SearchView
            onClose={() => setView("reader")}
            onNavigate={(bookId, chapter, verse) => {
              navigateTo(bookId, chapter, verse);
              setView("reader");
              setTimeout(() => updateTab(activeTabId, { verse: undefined }), 4000);
            }}
          />
        )}
      </div>

      <ToastContainer />

      {/* Bottom navigation bar */}
      <nav className={`overflow-x-auto no-scrollbar flex items-center justify-evenly border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0 transition-all duration-150 ${immersive && view === "reader" ? "max-h-0 !overflow-hidden py-0 border-t-0" : "max-h-20 py-2 border-t"}`}>
        <button
          onClick={() => setView("reader")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 shrink-0 ${
            view === "reader" ? "text-blue-600" : "text-gray-400"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-[10px]">{t("app.title")}</span>
        </button>

          <NavFeatureButtons
            features={tabBarFeatures}
            view={view}
            setView={setView}
            t={t}
          />

          <button
            data-tip-target="features-button"
            onClick={() => setView(view === "features" ? "reader" : "features")}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 shrink-0 ${
              view === "features" ? "text-blue-600" : "text-gray-400"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px]">{t("features.add")}</span>
          </button>

          <button
            data-tip-target="settings-button"
            onClick={() => setView("settings")}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1 shrink-0 ${
              view === "settings" ? "text-blue-600" : "text-gray-400"
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.11 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {hasNewNotice && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
              )}
            </div>
            <span className="text-[10px]">{t("settings.title")}</span>
          </button>
      </nav>
    </div>
    </>
  );
}

function NavFeatureButtons({
  features,
  view,
  setView,
  t,
}: {
  features: { id: string; labelKey: string }[];
  view: string;
  setView: (v: View) => void;
  t: (key: string) => string;
}) {
  const reorderFeature = useFeatureStore((s) => s.reorderFeature);
  const btnRefMap = useRef<Map<string, HTMLButtonElement>>(new Map());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragIdx = useRef<number | null>(null);
  const dragFeatureId = useRef<string | null>(null);
  const [dragActiveIdx, setDragActiveIdx] = useState<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const dragStartX = useRef(0);
  const justDragged = useRef(false);
  const swapCooldown = useRef(false);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  // Memoize feature ids to detect changes
  const featureIds = useMemo(() => features.map((f) => f.id), [features]);

  // Snapshot positions before React commits DOM changes
  const snapshotPositions = useCallback(() => {
    const rects = new Map<string, DOMRect>();
    for (const [id, el] of btnRefMap.current) {
      rects.set(id, el.getBoundingClientRect());
    }
    prevRectsRef.current = rects;
  }, []);

  // FLIP animation after reorder — uses Web Animations API (immune to React re-renders)
  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    if (prev.size === 0) return;
    prevRectsRef.current = new Map();
    if (!dragFeatureId.current) return;

    for (const [id, el] of btnRefMap.current) {
      if (dragFeatureId.current === id) continue;
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
  }, [featureIds]);

  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    // Declare early listeners first so they can be cleaned up when drag starts
    const cancelLongPress = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      document.removeEventListener("pointermove", onEarlyMove);
      document.removeEventListener("pointerup", cancelLongPress);
    };
    const onEarlyMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 10 || Math.abs(ev.clientY - startY) > 10) {
        cancelLongPress();
      }
    };
    longPressTimer.current = setTimeout(() => {
      // Clean up early listeners since drag is starting
      document.removeEventListener("pointermove", onEarlyMove);
      document.removeEventListener("pointerup", cancelLongPress);

      dragIdx.current = idx;
      dragFeatureId.current = featureIds[idx];
      dragStartX.current = startX;
      setDragActiveIdx(idx);
      setDragOffsetX(0);

      navigator.vibrate?.(30);

      const onMove = (ev: PointerEvent) => {
        if (dragIdx.current === null || !dragFeatureId.current) return;
        ev.preventDefault();
        setDragOffsetX(ev.clientX - dragStartX.current);

        if (swapCooldown.current) return;

        const currentIds = useFeatureStore.getState().featureOrder;
        const enabledIds = useFeatureStore.getState().enabledFeatures;
        const tabBarIds = currentIds.filter((id) => {
          const cfg = FEATURE_REGISTRY.find((f) => f.id === id);
          return cfg?.showInTabBar && enabledIds.includes(id);
        });
        for (const [id, el] of btnRefMap.current.entries()) {
          if (id === dragFeatureId.current) continue;
          const rect = el.getBoundingClientRect();
          const i = tabBarIds.indexOf(id);
          if (i < 0) continue;
          // Swap when pointer reaches the center of the target button
          const center = rect.left + rect.width / 2;
          const atCenter = Math.abs(ev.clientX - center) < rect.width * 0.3;
          if (atCenter && dragIdx.current !== i) {
            snapshotPositions();
            const fromOrderIdx = currentIds.indexOf(dragFeatureId.current!);
            const toOrderIdx = currentIds.indexOf(id);
            if (fromOrderIdx >= 0 && toOrderIdx >= 0) {
              reorderFeature(fromOrderIdx, toOrderIdx);
            }
            dragStartX.current = ev.clientX;
            setDragOffsetX(0);
            dragIdx.current = i;
            setDragActiveIdx(i);
            navigator.vibrate?.(15);
            // Cooldown to prevent rapid oscillation
            swapCooldown.current = true;
            setTimeout(() => { swapCooldown.current = false; }, 250);
            break;
          }
        }
      };
      const onUp = () => {
        dragIdx.current = null;
        dragFeatureId.current = null;
        setDragActiveIdx(null);
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
    <>
      {features.map((feature, idx) => (
        <button
          key={feature.id}
          ref={(el) => { if (el) btnRefMap.current.set(feature.id, el); else btnRefMap.current.delete(feature.id); }}
          onClick={() => { if (dragActiveIdx === null && !justDragged.current) setView(feature.id as View); }}
          onPointerDown={(e) => handlePointerDown(e, idx)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 shrink-0 touch-none ${
            view === feature.id ? "text-blue-600" : "text-gray-400"
          } ${dragActiveIdx === idx ? "z-10 relative" : ""}`}
          style={dragActiveIdx === idx ? { transform: `translateX(${dragOffsetX}px) scale(1.1)`, opacity: 0.8 } : undefined}
        >
          <NavFeatureIcon id={feature.id} />
          <span className="text-[10px]">{t(feature.labelKey)}</span>
        </button>
      ))}
    </>
  );
}

function NavFeatureIcon({ id }: { id: string }) {
  switch (id) {
    case "bookmarks":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      );
    case "highlights":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
        </svg>
      );
    case "notes":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}

export default App;
