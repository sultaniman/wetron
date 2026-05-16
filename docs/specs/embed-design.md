# `@wetron/embed` — Design

## Goal

Ship a self-contained IIFE bundle that a static HTML page can include with a single `<script>` tag and get a working model viewer with no build step, no npm install, and no framework knowledge.

Target use: course pages, paper appendices, model-card hosts, GitHub Pages, scientific notebooks exported to HTML.

## Non-goals

- Not a replacement for `@wetron/react` or `@wetron/svelte` — those remain the integration path for app authors.
- No SSR, no custom theming API beyond `data-color-mode`, no programmatic graph mutation.
- No bundled weight-loading helpers beyond what `parseModel` already accepts (the embed fetches the model URL; external ONNX shards / TF2 checkpoints are out of scope for v1).
- No service-worker, no offline caching, no CDN of its own — consumers self-host or pull from a CDN they trust (jsdelivr, unpkg).
- No iframe-sandboxed variant — that's a separate `@wetron/embed-frame` if ever needed.

## Renderer choice

Use `@wetron/svelte`. Two reasons:

- Svelte compiles to plain JS with no runtime — the IIFE bundle is materially smaller than React + ReactDOM + ReactFlow, which matters for a `<script>` that blocks first paint on a static page.
- It exercises the Svelte package, which currently has no production consumer in the repo.

Re-evaluate if `@wetron/svelte` weight-panel parity (`svelte-weight-panel-port-design.md`) stalls; in that case ship a React build first and switch later.

## Package layout

```
packages/embed/
  src/
    index.ts          # auto-mount + window.Wetron API
    mount.ts          # mount(el, options) — shared by both entry points
  vite.config.ts      # library mode, format: 'iife', name: 'Wetron'
  package.json
  tsconfig.json
  test/
    mount.test.ts
```

`package.json` exports a single `./dist/wetron.js` (IIFE) and `./dist/wetron.css`. No ESM export — that's what `@wetron/svelte` is for. CSS is inlined into the JS bundle and injected on first mount; the `.css` file is also emitted for consumers who prefer to ship it separately.

## Public API

### Markup-driven (primary)

```html
<script src="https://cdn.example/wetron@0.1/wetron.js" defer></script>
<div data-wetron-model="./resnet50.onnx" style="width:100%;height:600px"></div>
```

On `DOMContentLoaded` the bundle scans `document.querySelectorAll('[data-wetron-model]')` and mounts a viewer per element. Supported attributes:

| Attribute              | Value                   | Default       | Effect                                              |
| ---------------------- | ----------------------- | ------------- | --------------------------------------------------- |
| `data-wetron-model`    | URL (relative/abs)      | (required)    | `fetch`ed as `ArrayBuffer`, passed to `parseModel`. |
| `data-wetron-filename` | string                  | URL path tail | Used for magic-byte fallback and the panel title.   |
| `data-color-mode`      | `light`/`dark`/`system` | `system`      | Forwarded to the Svelte view.                       |
| `data-wetron-mounted`  | (set by us)             | —             | Marker so re-scans skip already-mounted elements.   |

Re-scan trigger: the script also fires a scan on `wetron:rescan` (custom event on `document`) so SPA-ish pages can mount nodes added after load.

### Programmatic (escape hatch)

```js
const handle = window.Wetron.mount(el, {
  url?: string,
  bytes?: Uint8Array,
  filename?: string,
  colorMode?: 'light' | 'dark' | 'system',
});
handle.unmount();
```

Exactly one of `url` or `bytes` is required. `window.Wetron.version` exposes the package version.

## Failure modes

The embed runs on pages where the author cannot debug — failures must be visible without devtools.

| Scenario                          | Behavior                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `fetch` fails (network/CORS/404)  | Render an in-element error card: "Could not load <url>: <status or message>".             |
| `parseModel` throws `ParseError`  | Render error card with `err.format` + `err.context`.                                      |
| Magic bytes match no known format | `parseModel` throws "unknown format"; surface as above.                                   |
| Element has no width/height       | Render a one-line warning inside the element; do not silently collapse.                   |
| `data-wetron-model` missing       | No-op (the selector wouldn't match anyway).                                               |
| Script included twice             | `window.Wetron.mount` becomes a no-op on the second copy; first load logs a console.warn. |

Errors never throw to the page — a script-tag embed must not break the host page's JS.

## Bundle budget

Target: **< 800 KB minified, < 250 KB brotli** for the JS bundle including Svelte runtime, `@xyflow/svelte`, all parsers, and `@wetron/core`. Measured at build time in CI; over-budget builds fail.

Parsers are the largest contributor. v1 keeps all of them in the single bundle for the "one script tag" promise. If the budget can't be hit, ship per-format builds (`wetron-onnx.js`, `wetron-tflite.js`, …) with the same API — the data-attribute is unchanged — and document the trade-off.

## Build

Vite library mode in `packages/embed/vite.config.ts`:

- `build.lib.formats: ['iife']`
- `build.lib.name: 'Wetron'`
- `build.cssCodeSplit: false` — single emitted CSS file.
- `define: { 'process.env.NODE_ENV': '"production"' }` so Svelte and any transitive deps drop dev checks.
- No externals — everything is inlined.

Add to root `package.json` `build:ui`: `(cd packages/embed && bunx vite build)` after the svelte build it depends on (introduce a `build:svelte` step alongside).

## Testing

- `mount.test.ts` (happy-dom): mount a fixture model via `bytes`, assert the container gets a SvelteFlow root and a node count matching the fixture's IR.
- Auto-mount test: inject `<div data-wetron-model="...">` plus a `fetch` mock, fire `DOMContentLoaded`, assert mount.
- Error-card test: `fetch` rejects → assert the element contains the error string and does _not_ throw.
- Bundle-size test: a Bun test that reads `dist/wetron.js` and `dist/wetron.js.br` (built in CI) and fails over budget.

## Docs

- New page `docs/content/docs/embed/_index.md` with a copy-pasteable snippet, the attribute table, and the CDN URL pattern.
- Restore the "single `<script>` tag" line in `README.md` only once the bundle ships and is reachable from a public CDN.
