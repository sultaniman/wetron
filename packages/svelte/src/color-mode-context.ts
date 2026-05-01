import { getContext, setContext } from "svelte";

export type ColorMode = "light" | "dark" | "system";

const KEY = Symbol("colorMode");

export function provideColorMode(getter: () => "light" | "dark") {
  setContext(KEY, getter);
}

export function consumeColorMode(): "light" | "dark" {
  const fn = getContext<() => "light" | "dark">(KEY);
  return fn ? fn() : resolveColorMode("system");
}

export function resolveColorMode(mode: ColorMode): "light" | "dark" {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
