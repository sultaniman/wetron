import { getContext, setContext } from "svelte";

export type ColorMode = "light" | "dark" | "system";

const KEY = Symbol("colorMode");

export function provideColorMode(ctx: { resolved: "light" | "dark" }) {
  setContext(KEY, ctx);
}

export function consumeColorMode(): "light" | "dark" {
  const ctx = getContext<{ resolved: "light" | "dark" }>(KEY);
  return ctx?.resolved ?? resolveColorMode("system");
}

export function resolveColorMode(mode: ColorMode): "light" | "dark" {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
