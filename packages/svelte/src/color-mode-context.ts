import { getContext, setContext } from "svelte";

export type ColorMode = "light" | "dark" | "system";

const KEY = Symbol("colorMode");

export function provideColorMode(mode: ColorMode) {
  setContext(KEY, mode);
}

export function consumeColorMode(): "light" | "dark" {
  const mode = getContext<ColorMode>(KEY) ?? "system";
  return resolveColorMode(mode);
}

export function resolveColorMode(mode: ColorMode): "light" | "dark" {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
