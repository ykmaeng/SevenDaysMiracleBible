/** Dynamically load Google Fonts on demand */

const loadedFonts = new Set<string>();

export function loadGoogleFont(fontFamily: string): void {
  if (!fontFamily || loadedFonts.has(fontFamily)) return;
  loadedFonts.add(fontFamily);

  const encoded = fontFamily.replace(/ /g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

/** Preload all Google Fonts for a given language's font options */
export function preloadFontsForLang(fonts: { id: string; googleFont?: string }[]): void {
  for (const f of fonts) {
    if (f.googleFont) {
      loadGoogleFont(f.googleFont);
    }
  }
}
