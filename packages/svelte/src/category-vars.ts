import { CATEGORY_THEME, type OpCategory } from "@wetron/tokens";

export function categoryVars(isDark: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const cat of Object.keys(CATEGORY_THEME) as OpCategory[]) {
    out[`--wetron-category-${cat}`] = isDark ? CATEGORY_THEME[cat].dark : CATEGORY_THEME[cat].light;
  }
  return out;
}
