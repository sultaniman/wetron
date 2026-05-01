import { createContext, useContext } from "react";

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

export function useColorMode(): "light" | "dark" {
  return resolveColorMode(useContext(ColorModeContext));
}
