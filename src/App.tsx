import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TabBar } from "./components/TabBar/TabBar";
import { TabPanel } from "./components/TabBar/TabPanel";
import { LanguageSettings } from "./components/Settings/LanguageSettings";

type View = "reader" | "settings";

function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("reader");

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Tab bar */}
      {view === "reader" && <TabBar />}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {view === "reader" && <TabPanel />}
        {view === "settings" && (
          <div className="h-full overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
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
      </div>

      {/* Bottom navigation bar */}
      <nav className="flex items-center justify-around border-t border-gray-200 bg-white py-2 shrink-0">
        <button
          onClick={() => setView("reader")}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 ${
            view === "reader" ? "text-blue-600" : "text-gray-400"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-[10px]">{t("app.title")}</span>
        </button>
        <button
          onClick={() => setView("settings")}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 ${
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

export default App;
