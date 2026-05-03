# @wetron/tokens

Design tokens for wetron graph visualization components. Theme colors for op categories, minimap and edge styling, and CSS custom property maps for canvas and panel theming. Zero dependencies.

## Install

```bash
bun add @wetron/tokens
```

## API

```ts
import { CATEGORY_THEME, MINIMAP_THEME, EDGE_THEME, CANVAS_VARS, PANEL_VARS } from "@wetron/tokens";

// Node header colors by op category
CATEGORY_THEME["conv"].light; // "#4a90d9"
CATEGORY_THEME["conv"].dark; // "#2d6aad"

// Apply canvas CSS variables
for (const [key, value] of Object.entries(CANVAS_VARS.light)) {
  element.style.setProperty(key, value);
}
```

## Exports

| Export           | Description                                         |
| ---------------- | --------------------------------------------------- |
| `CATEGORY_THEME` | Node header colors keyed by `OpCategory`            |
| `MINIMAP_THEME`  | Minimap background, node color, mask color          |
| `EDGE_THEME`     | Selected edge stroke color and width                |
| `CANVAS_VARS`    | ReactFlow/SvelteFlow `--xy-*` CSS custom properties |
| `PANEL_VARS`     | Property panel `--panel-*` CSS custom properties    |

## Notes

- No dependency on `@wetron/core` — can be used standalone.
- `OpCategory` type is defined locally in this package.
