export type ColormapKind = "sequential" | "diverging" | "constant";

export function pickColormap(min: number, max: number): ColormapKind {
  if (min === max) return "constant";
  if (min < 0 && max > 0) return "diverging";
  return "sequential";
}

export function colorForCell(value: number, min: number, max: number, kind: ColormapKind): string {
  if (kind === "constant") return "#cbd5e1";
  if (kind === "diverging") {
    const maxAbs = Math.max(Math.abs(min), Math.abs(max));
    const t = Math.max(-1, Math.min(1, value / maxAbs));
    // -1 -> deep blue, 0 -> pale white, +1 -> deep red.
    if (t < 0) return mix("#f8fafc", "#1d4ed8", -t);
    return mix("#f8fafc", "#dc2626", t);
  }
  // sequential: pale green -> deep green, t in [0,1].
  const t = (value - min) / (max - min);
  return mix("#dcfce7", "#15803d", Math.max(0, Math.min(1, t)));
}

/** linear interpolation between two #rrggbb colors. amount in [0,1]. */
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
