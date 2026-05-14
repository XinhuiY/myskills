import { createContext, useContext, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  suiLight,
  suiDark,
  suiHighContrast,
  suiJunoLight,
} from "@ringcentral/spring-theme";
import { DEFAULT_SCREEN, type ScreenId } from "../screens";

// `@ringcentral/spring-theme` ships exactly four themes:
//   suiLight, suiDark, suiHighContrast, suiJunoLight
// There is intentionally NO `suiJunoDark` export. Do not add a "junoDark"
// option that aliases to `suiDark` — it would silently mis-style anything
// juno-specific. If a Figma frame is in "Juno Dark" mode, surface that to
// the user instead of fabricating a theme.
export type ThemeOption =
  | "light"
  | "dark"
  | "highContrast"
  | "junoLight";

const themeMap = {
  light: suiLight,
  dark: suiDark,
  highContrast: suiHighContrast,
  junoLight: suiJunoLight,
} as const;

interface PresentationConfigContextValue {
  themeOption: ThemeOption;
  setThemeOption: (t: ThemeOption) => void;
  themeObject: typeof suiLight;
  screen: ScreenId;
  setScreen: (s: ScreenId) => void;
}

const PresentationConfigContext =
  createContext<PresentationConfigContextValue | null>(null);

export function usePresentationConfig() {
  const ctx = useContext(PresentationConfigContext);
  if (!ctx)
    throw new Error(
      "usePresentationConfig must be used within PresentationConfigProvider",
    );
  return ctx;
}

// PresentationConfigProvider requires React Router v6 — wrap the app in
// <BrowserRouter> (or <MemoryRouter> for embedded environments) before
// mounting this provider.
export function PresentationConfigProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();

  // Default to the Spring theme matching the Figma frame's color mode.
  // Override per-screen scaffold (e.g. Figma "Juno Light" → "junoLight").
  // "light" is the default — omitted from the URL to keep clean URLs short.
  const themeParam = params.get("theme") as ThemeOption | null;
  const themeOption: ThemeOption =
    themeParam && themeParam in themeMap ? themeParam : "light";
  const setThemeOption = (t: ThemeOption) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (t === "light") next.delete("theme");
        else next.set("theme", t);
        return next;
      },
      { replace: false },
    );

  // DEFAULT_SCREEN is omitted from the URL so the base URL is clean on first load.
  const screenParam = params.get("screen") as ScreenId | null;
  const screen: ScreenId = screenParam ?? DEFAULT_SCREEN;
  const setScreen = (s: ScreenId) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === DEFAULT_SCREEN) next.delete("screen");
        else next.set("screen", s);
        return next;
      },
      { replace: false },
    );

  const value: PresentationConfigContextValue = {
    themeOption,
    setThemeOption,
    themeObject: themeMap[themeOption],
    screen,
    setScreen,
  };

  return (
    <PresentationConfigContext.Provider value={value}>
      {children}
    </PresentationConfigContext.Provider>
  );
}
