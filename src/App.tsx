import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TabBar } from "./components/TabBar/TabBar";
import { TabPanel } from "./components/TabBar/TabPanel";
import { ToastContainer } from "./components/Toast";
import { LanguageSettings } from "./components/Settings/LanguageSettings";
import { LanguageOnboarding } from "./components/Onboarding/LanguageOnboarding";
import { FeaturesView } from "./components/Features/FeaturesView";
import { BookmarksView } from "./components/Bookmarks/BookmarksView";
import { HighlightsView } from "./components/Highlights/HighlightsView";
import { useSettingsStore } from "./stores/settingsStore";
import { useFeatureStore, FEATURE_REGISTRY } from "./stores/featureStore";
import { useTabStore } from "./stores/tabStore";
import { loadGoogleFont } from "./lib/googleFonts";

type View = "reader" | "settings" | "features" | "bookmarks" | "highlights";

function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("reader");
  const [immersive, setImmersive] = useState(false);
  const theme = useSettingsStore((s) => s.theme);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const enabledFeatures = useFeatureStore((s) => s.enabledFeatures);
  const navigateTo = useTabStore((s) => s.navigateTo);

  const tabBarFeatures = FEATURE_REGISTRY.filter(
    (f) => f.showInTabBar && enabledFeatures.includes(f.id)
  );

  // Listen for open-settings event (e.g. from download banner)
  useEffect(() => {
    const handler = () => setView("settings");
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, []);

  // Immersive reading mode
  useEffect(() => {
    const handler = (e: Event) => {
      const fullscreen = (e as CustomEvent).detail;
      setImmersive(fullscreen);
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

  if (!onboardingComplete) {
    return (
      <div className="h-screen bg-white dark:bg-gray-900 dark:text-gray-100">
        <LanguageOnboarding />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 dark:text-gray-100">
      {/* Tab bar */}
      {view === "reader" && (
        <div className={`transition-all duration-300 overflow-hidden ${immersive ? "max-h-0" : "max-h-20"}`}>
          <TabBar />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
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
            }}
          />
        )}
        {view === "highlights" && (
          <HighlightsView
            onClose={() => setView("reader")}
            onNavigate={(bookId, chapter, verse) => {
              navigateTo(bookId, chapter, verse);
              setView("reader");
            }}
          />
        )}
      </div>

      <ToastContainer />

      {/* Bottom navigation bar */}
      <nav className={`flex items-center justify-around border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0 transition-all duration-300 overflow-hidden ${immersive && view === "reader" ? "max-h-0 py-0" : "max-h-20 py-2"}`}>
        <button
          onClick={() => setView("reader")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 ${
            view === "reader" ? "text-blue-600" : "text-gray-400"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-[10px]">{t("app.title")}</span>
        </button>

        {tabBarFeatures.map((feature) => (
          <button
            key={feature.id}
            onClick={() => setView(feature.id as View)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 ${
              view === feature.id ? "text-blue-600" : "text-gray-400"
            }`}
          >
            <NavFeatureIcon id={feature.id} />
            <span className="text-[10px]">{t(feature.labelKey)}</span>
          </button>
        ))}

        <button
          onClick={() => setView("features")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 ${
            view === "features" ? "text-blue-600" : "text-gray-400"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[10px]">{t("features.add")}</span>
        </button>

        <button
          onClick={() => setView("settings")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 ${
            view === "settings" ? "text-blue-600" : "text-gray-400"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[10px]">{t("settings.title")}</span>
        </button>
      </nav>
    </div>
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
    default:
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}

export default App;
