import { createContext, useContext, useState, useEffect } from "react";

export type ColorMode = "light" | "dark" | "system";

export const ColorModeContext = createContext<ColorMode>("system");

export function resolveColorMode(mode: ColorMode): "light" | "dark" {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useResolvedColorMode(mode: ColorMode): "light" | "dark" {
  const [systemDark, setSystemDark] = useState(() => {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (mode !== "system") return;
    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      setSystemDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } catch {}
  }, [mode]);
  if (mode !== "system") return mode;
  return systemDark ? "dark" : "light";
}

export function useColorMode(): "light" | "dark" {
  const mode = useContext(ColorModeContext);
  return useResolvedColorMode(mode);
}
