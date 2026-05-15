const INTEGER_PREFIXES = ["int", "uint"] as const;

export function isIntegerDtype(dtype: string): boolean {
  if (dtype === "bool") return true;
  return INTEGER_PREFIXES.some((p) => dtype.startsWith(p));
}

export function formatVal(v: number, dtype: string): string {
  if (Number.isNaN(v)) return "NaN";
  if (!Number.isFinite(v)) return v > 0 ? "+Inf" : "-Inf";
  if (v === 0) return "0";
  if (isIntegerDtype(dtype)) return v.toFixed(0);

  const abs = Math.abs(v);
  if (abs >= 1000 || abs < 0.001) {
    // scientific, 2 sig figs (e.g. "1.5e-4", "2.5e+7", "-9.0e-4")
    return v.toExponential(1);
  }

  // 3 decimals, strip leading zero: "0.045" -> ".045", "-0.184" -> "-.184"
  const fixed = v.toFixed(3);
  return fixed.replace(/^(-?)0\./, "$1.");
}
