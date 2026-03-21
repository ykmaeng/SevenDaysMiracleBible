import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";

interface Step {
  targetSelector: string;
  textKey: string;
  tooltipPosition: "bottom" | "top" | "center";
}

const STEPS: Step[] = [
  {
    targetSelector: "[data-verse=\"1\"]",
    textKey: "tips.verseAction",
    tooltipPosition: "bottom",
  },
  {
    targetSelector: '[data-tip-target="reader-area"]',
    textKey: "tips.swipeNav",
    tooltipPosition: "center",
  },
  {
    targetSelector: '[data-tip-target="reader-settings"]',
    textKey: "tips.readerSettings",
    tooltipPosition: "bottom",
  },
  {
    targetSelector: '[data-tip-target="features-button"]',
    textKey: "tips.featuresButton",
    tooltipPosition: "top",
  },
  {
    targetSelector: '[data-tip-target="settings-button"]',
    textKey: "tips.settingsButton",
    tooltipPosition: "top",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const RADIUS = 12;

export function GuidedTips() {
  const { t } = useTranslation();
  const tipsComplete = useSettingsStore((s) => s.tipsComplete);
  const completeTips = useSettingsStore((s) => s.completeTips);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const measureTarget = useCallback(() => {
    const s = STEPS[step];
    if (!s) return;
    const el = document.querySelector(s.targetSelector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rect: Rect = {
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    };
    setTargetRect(rect);
  }, [step]);

  // Exit immersive mode so bottom nav is visible for targeting
  useEffect(() => {
    if (tipsComplete) return;
    window.dispatchEvent(new CustomEvent("reader-fullscreen", { detail: false }));
  }, [tipsComplete]);

  useEffect(() => {
    if (tipsComplete) return;
    const timer = setTimeout(() => {
      measureTarget();
      setVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [step, tipsComplete, measureTarget]);

  // Re-measure on resize
  useEffect(() => {
    if (tipsComplete) return;
    window.addEventListener("resize", measureTarget);
    return () => window.removeEventListener("resize", measureTarget);
  }, [tipsComplete, measureTarget]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setVisible(false);
      setTimeout(() => setStep((s) => s + 1), 150);
    } else {
      completeTips();
    }
  }, [step, completeTips]);

  const handleSkip = useCallback(() => {
    completeTips();
  }, [completeTips]);

  if (tipsComplete || !targetRect) return null;

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Tooltip positioning — always horizontally centered
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 10001,
    width: "min(320px, calc(100vw - 32px))",
    left: "50%",
    transition: "opacity 300ms, transform 300ms",
    opacity: visible ? 1 : 0,
  };

  const showArrow = currentStep.tooltipPosition !== "center";

  if (currentStep.tooltipPosition === "bottom") {
    tooltipStyle.top = targetRect.top + targetRect.height + 12;
    tooltipStyle.transform = visible
      ? "translateX(-50%) translateY(0)"
      : "translateX(-50%) translateY(8px)";
  } else if (currentStep.tooltipPosition === "center") {
    tooltipStyle.top = targetRect.top + targetRect.height / 2;
    tooltipStyle.transform = visible
      ? "translate(-50%, -50%)"
      : "translate(-50%, -40%)";
  } else {
    tooltipStyle.bottom = window.innerHeight - targetRect.top + 12;
    tooltipStyle.transform = visible
      ? "translateX(-50%) translateY(0)"
      : "translateX(-50%) translateY(-8px)";
  }

  const spotlightShadow = `0 0 0 9999px rgba(0,0,0,0.6)`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0"
      style={{ zIndex: 10000 }}
      onClick={handleNext}
    >
      {/* Spotlight cutout */}
      <div
        style={{
          position: "fixed",
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          borderRadius: RADIUS,
          boxShadow: spotlightShadow,
          transition: "top 300ms ease, left 300ms ease, width 300ms ease, height 300ms ease",
          pointerEvents: "none",
        }}
      />

      {/* Tooltip */}
      <div
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl px-5 py-4 shadow-2xl relative">
          {/* Arrow */}
          {showArrow && (
            <div
              className="absolute w-3 h-3 bg-white dark:bg-gray-800 rotate-45"
              style={
                currentStep.tooltipPosition === "bottom"
                  ? { top: -6, left: "50%", marginLeft: -6 }
                  : { bottom: -6, left: "50%", marginLeft: -6 }
              }
            />
          )}

          <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed mb-3">
            {t(currentStep.textKey)}
          </p>

          <div className="flex items-center justify-between gap-4">
            {/* Step dots */}
            <div className="flex gap-1.5 shrink-0">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === step ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 shrink-0">
              {!isLast && (
                <button
                  onClick={handleSkip}
                  className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap"
                >
                  {t("tips.skip")}
                </button>
              )}
              <button
                onClick={handleNext}
                className="text-xs font-medium text-white bg-blue-500 rounded-full px-4 py-1.5 whitespace-nowrap"
              >
                {isLast ? t("tips.start") : t("tips.next")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
