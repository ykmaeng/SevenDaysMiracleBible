import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFeatureStore, FEATURE_REGISTRY } from "../../stores/featureStore";

interface FeaturesViewProps {
  onClose: () => void;
}

export function FeaturesView({ onClose }: FeaturesViewProps) {
  const { t } = useTranslation();
  const { enabledFeatures, toggleFeature } = useFeatureStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between z-10">
        <h2 className="text-lg font-semibold">{t("features.title")}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4">
        {FEATURE_REGISTRY.map((feature) => {
          const enabled = enabledFeatures.includes(feature.id);
          const expanded = expandedId === feature.id;

          return (
            <div
              key={feature.id}
              className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpandedId(expanded ? null : feature.id)}
              >
                <FeatureIcon id={feature.id} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t(feature.labelKey)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t(feature.descKey)}
                  </div>
                  <div className="flex gap-1.5 mt-1.5">
                    {feature.showInTabBar && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        {t("features.tabBar")}
                      </span>
                    )}
                    {feature.showInFloating && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                        {t("features.floatingMenu")}
                      </span>
                    )}
                    {feature.showInReaderSettings && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400">
                        {t("features.readerSettings")}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFeature(feature.id);
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                    enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      enabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              {expanded && (
                <div className="px-4 pb-4 text-xs text-gray-500 dark:text-gray-400">
                  {t(feature.instructionKey)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeatureIcon({ id }: { id: string }) {
  const iconClass = "w-8 h-8 p-1.5 rounded-lg";
  switch (id) {
    case "bookmarks":
      return (
        <div className={`${iconClass} bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
      );
    case "highlights":
      return (
        <div className={`${iconClass} bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400`}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        </div>
      );
    case "notes":
      return (
        <div className={`${iconClass} bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400`}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      );
    case "commentary":
      return (
        <div className={`${iconClass} bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400`}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
      );
    case "interlinear":
      return (
        <div className={`${iconClass} bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400`}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
          </svg>
        </div>
      );
    case "dictionary":
      return (
        <div className={`${iconClass} bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400`}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
      );
    case "tabs":
      return (
        <div className={`${iconClass} bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400`}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h6V4h12v14h-6v3H3V7zm6 0v11m0-11h9" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}
