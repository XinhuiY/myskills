import { createContext, useContext, useState, type ReactNode } from "react";
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

export function PresentationConfigProvider({ children }: { children: ReactNode }) {
  // Default to the Spring theme matching the Figma frame's color mode.
  // Override per-screen scaffold (e.g. Figma "Juno Light" → "junoLight").
  const [themeOption, setThemeOption] = useState<ThemeOption>("light");
  const [screen, setScreen] = useState<ScreenId>(DEFAULT_SCREEN);

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
