import { SunIcon, MoonIcon, DesktopIcon } from "@phosphor-icons/react";
import type { ColorMode } from "@wetron/react";

export type { ColorMode };

export const MODE_CYCLE: readonly ColorMode[] = ["system", "light", "dark"];
export const MODE_LABEL: Record<ColorMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
export const MODE_ICON: Record<ColorMode, typeof SunIcon> = {
  system: DesktopIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export function resolveMode(mode: ColorMode): "light" | "dark" {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
