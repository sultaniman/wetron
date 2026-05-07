export type ColormapKind = "sequential" | "constant";

export function pickColormap(min: number, max: number): ColormapKind {
  if (min === max) return "constant";
  return "sequential";
}

const STOPS_LIGHT: readonly string[] = [
  "#eff6ff",
  "#bfdbfe",
  "#60a5fa",
  "#2563eb",
  "#1e3a8a",
];

const STOPS_DARK: readonly string[] = [
  "#bfdbfe",
  "#93c5fd",
  "#3b82f6",
  "#1d4ed8",
  "#1e3a8a",
];

export function colorForCell(
  value: number,
  min: number,
  max: number,
  kind: ColormapKind,
  isDark = false,
): string {
  if (kind === "constant") return "#cbd5e1";
  const range = max - min;
  const stops = isDark ? STOPS_DARK : STOPS_LIGHT;
  if (range === 0) return stops[0];
  const t = Math.max(0, Math.min(1, (value - min) / range));
  return interpolateStops(t, stops);
}

function interpolateStops(t: number, stops: readonly string[]): string {
  const segments = stops.length - 1;
  const segmentLen = 1 / segments;
  const segIdx = Math.min(Math.floor(t / segmentLen), segments - 1);
  const localT = Math.max(0, Math.min(1, (t - segIdx * segmentLen) / segmentLen));
  return mix(stops[segIdx], stops[segIdx + 1], localT);
}

function mix(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const r = Math.round(ar + (br - ar) * amount);
  const g = Math.round(ag + (bg - ag) * amount);
  const bl = Math.round(ab + (bb - ab) * amount);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
