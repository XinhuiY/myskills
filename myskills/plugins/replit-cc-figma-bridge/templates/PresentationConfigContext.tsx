import { createContext, useContext, useState, type ReactNode } from "react";
import { suiLight, suiDark, suiHighContrast } from "@ringcentral/spring-theme";
import { DEFAULT_SCREEN, type ScreenId } from "../screens";

export type ThemeOption = "light" | "dark" | "highContrast";

const themeMap = {
  light: suiLight,
  dark: suiDark,
  highContrast: suiHighContrast,
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
