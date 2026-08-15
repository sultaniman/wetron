# `@wetron/embed` - Design

Status: proposed. Supersedes the previous embed design (IIFE + `data-wetron-model` divs + `window.Wetron.mount()`).

Ship a no-build, drop-in HTML element for embedding the wetron model viewer. Target: internal portals (model registries, audit dashboards, intranet wikis), with public embed (model cards, MDX docs, papers) working but not driving the design.

The element is a Web Component:

```html
<script type="module" src="https://unpkg.com/@wetron/embed"></script>
<wetron-viewer src="https://example.com/model.onnx"></wetron-viewer>
```

## Goals

- Single bundled ESM script tag mounts a working viewer with no build step on the host.
- Declarative HTML attributes are the canonical API; JS escape hatch on the element instance for advanced cases.
- Multiple `<wetron-viewer>` instances on one page behave correctly: shared fetch cache, isolated Shadow DOM, no global collisions.
- Host pages can theme the viewer with standard CSS custom properties via `@wetron/tokens`, including dark/light mode toggling.
- Hosts can react to load/error/selection events via standard `CustomEvent` and can override the built-in error UI with a slot.
- Built on `@wetron/svelte` so the bundle stays materially smaller than a React-based equivalent and so the embed has clean custom-element semantics via Svelte 5's first-class CE compilation.

## Non-goals

- No top-level `window.Wetron` global. Element registration is the public surface.
- No IIFE bundle. ESM only - modern browsers support modules from a `<script type="module">` tag.
- No auto-scan / `wetron:rescan` event. Standard custom-element upgrade is sufficient.
- No file upload, drag-drop, or inline base64 data in v1. The viewer renders what `src` points at.
- No Web Worker parsing in v1. Parse runs on the main thread; documented as a known cost for large models.
- No lazy parser loading by format in v1. All parsers bundled; total bundle is large but cached after first load. Lazy loading is a future optimization if public embed grows.
- No hard bundle budget enforced in CI. Soft budget surfaced as a CI warning so regressions are visible without gating releases.
- No iframe-sandboxed variant. That stays a separate concern if ever needed.
- No `@wetron/snapshot` static-HTML CLI. Separate spec, separate package.

## Renderer choice

Wrap `@wetron/svelte`'s `ModelGraphView` component. Two reasons:

1. **Bundle size.** Svelte compiles components to direct DOM operations with a runtime of ~8-12 KB gzipped vs. React+ReactDOM at ~45 KB. After adding Svelte equivalents for `@base-ui/react` Tooltip / ScrollArea / Tabs (estimated ~150-200 lines / ~2-3 KB gzipped), the Svelte stack is ~60-80 KB smaller than the React equivalent at full UX parity.
2. **Bundle-size headroom for clean CE semantics.** The savings buy us the freedom to author a hand-rolled `HTMLElement` subclass (rather than rely on Svelte's `<svelte:options customElement>` auto-generation, which makes imperative methods on the element awkward to expose) without the React-in-CE adapter weight or quirks.

**Precondition:** `@wetron/svelte` must be at full UX parity with `@wetron/react`. The remaining gap (rankdir, sub-graph navigation on the export ref, `onOpenSubGraph` callback, scope-chrome icon) is tracked in `svelte-react-parity-design.md` and is a hard blocker for `@wetron/embed` v1.

### Element-to-Svelte boundary

`@wetron/embed` authors `WetronViewerElement extends HTMLElement` directly. It does **not** use Svelte 5's `<svelte:options customElement="...">` auto-compilation. Instead, in `connectedCallback` it imperatively mounts a Svelte `ModelGraphView` instance inside its Shadow DOM:

```ts
import { mount, unmount } from 'svelte';
import { ModelGraphView } from '@wetron/svelte';

connectedCallback() {
  this.attachShadow({ mode: 'open' });
  this.#injectStyles(this.shadowRoot);
  this.#svelteInstance = mount(ModelGraphView, {
    target: this.shadowRoot,
    props: this.#buildPropsFromAttrs(),
  });
}
disconnectedCallback() {
  unmount(this.#svelteInstance);
}
```

`attributeChangedCallback` updates the Svelte instance's reactive props (Svelte 5 `mount` returns an object exposing the props as `$state`). Imperative methods (`fitAll`, `exportPNG`, `navigateInto`) on the element call into the `ExportHelpers` ref provided by `ModelGraphView` (covered by the parity spec).

Rationale for not using `<svelte:options customElement>`:

- Imperative element methods (`el.fitAll()`, `el.exportPNG()`) require workarounds on Svelte's generated element class.
- Custom event names (`wetron-load`, `wetron-error`) and the `composed: true` flag are easier to dispatch from a hand-rolled element than from Svelte's built-in event forwarding.
- Slot handling and Shadow DOM style injection are owned explicitly by the element class.
- The element class is small (~150 lines) - the auto-generation savings are not worth the loss of control.

## Package layout

```
packages/embed/
  src/
    element.ts        # WetronViewerElement class
    url-cache.ts      # module-scoped fetch cache
    error-ui.ts       # built-in error message renderer
    index.ts          # side-effectful: registers element on import
  test/
    element.test.ts   # vitest + happy-dom
    fixtures/         # small test models (re-export from test-models/)
  vite.config.ts      # library mode, ESM, single bundle, CSS inlined
  package.json
  tsconfig.json
```

`package.json`:

```jsonc
{
  "name": "@wetron/embed",
  "type": "module",
  "exports": {
    ".": "./dist/wetron-embed.js",
    "./element": "./dist/element.js",
  },
  "sideEffects": ["./dist/wetron-embed.js"],
}
```

- Default entry is side-effectful: importing `@wetron/embed` registers the element. Matches the consumer expectation that the tag works after `<script>` runs.
- Secondary `./element` exports the class without registering it, for hosts that want a different tag name or want to extend the class.
- No `peerDependencies`. All runtime deps are bundled - this is the "batteries included" entry point. The `dependencies` set covers `@wetron/svelte`, `@wetron/core`, `@wetron/common`, all parser packages, `@xyflow/svelte`, `phosphor-svelte`, `@tanstack/svelte-virtual`, and `svelte` (consumed as the compiler runtime).

## Public API

### Attributes (declarative)

All attributes are observed via `static observedAttributes`. `attributeChangedCallback` routes each to either a re-load or a renderer-prop update (see Lifecycle).

| Attribute           | Type        | Default     | Behavior                                                                                                        |
| ------------------- | ----------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `src`               | URL         | -           | Fetched on connect and on change. Triggers parse.                                                               |
| `format`            | enum string | auto-detect | `onnx` \| `tflite` \| `keras` \| `torchscript` \| `executorch` \| `savedmodel`. Overrides magic-byte detection. |
| `color-mode`        | enum string | `system`    | `system` \| `light` \| `dark`. `system` listens to `prefers-color-scheme`.                                      |
| `rankdir`           | enum string | `TB`        | `TB` \| `LR`. Forwarded to the Svelte renderer. Requires parity work shipped.                                   |
| `height`            | CSS length  | `400px`     | Width always fills parent.                                                                                      |
| `no-minimap`        | boolean     | absent      | When present, hides the minimap.                                                                                |
| `no-property-panel` | boolean     | absent      | When present, hides the node property panel.                                                                    |
| `no-fit-view`       | boolean     | absent      | When present, hides the fit-view button.                                                                        |
| `no-export`         | boolean     | absent      | When present, hides PNG/SVG export controls.                                                                    |
| `state`             | enum string | `idle`      | **Reflected by the element**, not set by host. `idle` \| `loading` \| `ready` \| `error`. Useful for CSS hooks. |

Boolean controls use `no-X` (not `show-X`) so the default state of "everything visible" matches an empty tag.

### Properties (JS-side, on the element instance)

```ts
class WetronViewerElement extends HTMLElement {
  readonly graph: ModelGraph | null; // null until parsed
  readonly ready: Promise<ModelGraph>; // resolves on load, rejects on error
  readonly state: "idle" | "loading" | "ready" | "error";
  readonly error: ParseError | Error | null;
}
```

`ready` is a fresh Promise per `src` change. Hosts that re-set `src` get a new Promise to await.

### Methods

```ts
el.fitAll(): void;
el.exportPNG(): Promise<Blob>;
el.exportSVG(): Promise<Blob>;
el.selectNode(nodeId: string): void;
el.navigateInto(subGraphId: string): void;
el.navigateBack(): void;
```

All methods are safe to call before `ready` resolves; they queue or no-op.

### Events (CustomEvent, `bubbles: true`, `composed: true`)

| Event                | `detail`                                                    | Fires when                  |
| -------------------- | ----------------------------------------------------------- | --------------------------- |
| `wetron-load`        | `{ graph: ModelGraph }`                                     | Parse succeeds.             |
| `wetron-error`       | `{ format: string \| null, context: string, error: Error }` | Fetch or parse fails.       |
| `wetron-node-select` | `{ nodeId: string, node: ModelNode }`                       | User clicks a node.         |
| `wetron-navigate`    | `{ direction: 'into' \| 'back', subGraphId?: string }`      | Sub-graph drilling happens. |

`composed: true` so events cross the Shadow DOM boundary and hosts can listen from outside.

### Slots

One named slot for host-supplied error UI:

```html
<wetron-viewer src="model.onnx">
  <div slot="error">Couldn't load model. <a href="#">Open in Wetron</a></div>
</wetron-viewer>
```

Defaults to a one-line built-in error message when no slot is provided.

### TypeScript

```ts
declare global {
  interface HTMLElementTagNameMap {
    "wetron-viewer": WetronViewerElement;
  }
}
```

Consumers get typed `document.querySelector('wetron-viewer')` results without extra imports.

## Lifecycle and runtime

### Per-instance lifecycle

```
connectedCallback()
    └── if src present → start load sequence
attributeChangedCallback(name, oldValue, newValue)
    ├── 'src'        → cancel in-flight load (AbortController), start new
    ├── 'format'     → ignored if no src; re-parses cached bytes if src unchanged
    ├── 'rankdir'    → forward to renderer; no re-fetch, no re-parse
    ├── 'color-mode' → forward to renderer; no re-fetch
    └── 'no-*'       → forward to renderer; no re-fetch
disconnectedCallback()
    ├── abort in-flight fetch
    ├── decrement URL-cache refcount; evict if zero
    └── tear down Svelte renderer
```

Load sequence:

1. Reflect `state="loading"`.
2. Check module-scoped URL cache. If hit, await the cached `Promise<ArrayBuffer>` and increment refcount.
3. If miss, `fetch(src, { signal })` → `arrayBuffer()` → store Promise + refcount=1 in cache.
4. `parseModel(bytes, srcBasename, formatHint)` from `@wetron/core` on the main thread.
5. On success: reflect `state="ready"`, set `graph`, resolve `ready`, dispatch `wetron-load`.
6. On failure: reflect `state="error"`, set `error`, reject `ready`, dispatch `wetron-error`, render built-in or slotted error UI.

### Multi-instance behavior

```ts
// Module scope, runs once when bundle loads.
if (!customElements.get("wetron-viewer")) {
  customElements.define("wetron-viewer", WetronViewerElement);
}
```

- **Define guard** prevents the "already defined" throw when two `<script>` tags import different `@wetron/embed` versions on the same page. First registration wins.
- **URL cache** is module-scoped (`Map<string, { promise: Promise<ArrayBuffer>; refs: number }>`). Multiple `<wetron-viewer>` tags pointing at the same `src` share one fetch and one decoded `ArrayBuffer`. Refcount on connect/disconnect; entry evicted when refs hit zero so the buffer isn't retained forever.
- **Parsing is per-instance, not shared.** The cache holds raw bytes; parsing runs once per element on the main thread. Acceptable for v1; can later be moved into a shared Web Worker pool if many-large-viewers-per-page scenarios prove painful.

### Theming

Shadow DOM `mode: 'open'` per instance. Inject the bundled CSS once per shadow root.

Host theming surface = CSS custom properties piercing the shadow boundary:

```css
wetron-viewer {
  --wetron-bg: #fff;
  --wetron-fg: #1a1a1a;
  --wetron-node-border: var(--app-border);
  --wetron-category-conv: #4a90e2;
  /* ...mirrors @wetron/tokens */
}
```

The custom-property list comes straight from `@wetron/tokens` - no new theming surface invented here. `color-mode` switches token packs; `system` mode attaches a `MatchMedia` listener on connect and tears it down on disconnect.

### Error model

| Class     | Trigger                             | `wetron-error.detail`                                    |
| --------- | ----------------------------------- | -------------------------------------------------------- |
| Network   | `fetch` rejects or non-2xx response | `{ format: null, context: 'fetch', error }`              |
| Detection | `detectFormat` returns `"unknown"`  | `{ format: null, context: 'detect', error: ParseError }` |
| Parse     | parser throws `ParseError`          | `{ format, context, error: ParseError }`                 |

In all three cases the element:

- Reflects `state="error"`.
- Sets `el.error`.
- Rejects `el.ready`.
- Dispatches `wetron-error` (bubbles, composed).
- Renders built-in error UI in the shadow root, or the host's `<div slot="error">` if provided.

Errors never throw to the host page. A script-tag embed must not break the host's JS.

## Distribution

### npm

`@wetron/embed`, single ESM entry. No peer deps - everything bundled.

### CDN

Pre-bundled `dist/wetron-embed.js` served via unpkg and jsdelivr from the `main` field of `package.json`. Consumer pattern:

```html
<script type="module" src="https://unpkg.com/@wetron/embed@0.1.0"></script>
<wetron-viewer src="model.onnx" height="600px"></wetron-viewer>
```

Docs encourage pinning by version (`@wetron/embed@0.1.0`); floating `@wetron/embed` works but exposes consumers to silent breakage on minor bumps. Subresource Integrity (SRI) snippets are documented but not auto-generated.

### Build

Vite library mode in `packages/embed/vite.config.ts`:

- `build.lib.formats: ['es']`
- `build.lib.entry: 'src/index.ts'`
- `build.cssCodeSplit: false`; CSS inlined into the JS bundle (Shadow DOM means no external stylesheet to ship).
- `define: { 'process.env.NODE_ENV': '"production"' }` so Svelte and any transitive deps drop dev checks.
- No externals - all wetron and Svelte deps inlined.
- Source maps emitted alongside.

Root `package.json` adds `build:embed`: depends on `build:svelte`, then `(cd packages/embed && pnpm exec vite build)`.

### Versioning

Semver aligned with the wetron monorepo (`0.0.X` while pre-1.0). License: MIT.

### Bundle size monitoring

CI step measures `dist/wetron-embed.js` and `dist/wetron-embed.js.br` (brotli) after build. Emits a warning when size grows by more than 10% compared to the previous release; does not fail the build. Targets are informational, not gates:

- Initial: < 250 KB gzipped (parsers dominate).
- Per-format breakdown logged for future lazy-loading decisions.

## Testing

Three integration tests in `packages/embed/test/element.test.ts` (vitest + happy-dom). No unit tests; the element is small enough that behavior tests cover it.

| Test              | What it locks in                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Happy path        | `<wetron-viewer src="...">` with a real fixture renders, dispatches `wetron-load` with the parsed graph, reflects `state="ready"`.                            |
| Error contract    | A bad fixture or wrong `format` dispatches `wetron-error` with `{ format, context, error }`, reflects `state="error"`.                                        |
| Live `src` change | Mount with `src=A`, await `wetron-load`, change `src=B`, await `wetron-load` again, assert second graph differs. Verifies `attributeChangedCallback` routing. |

Explicitly not tested in v1:

- URL cache refcount math (implementation detail; visible breakage would surface as `wetron-load` not firing - covered by happy path).
- `customElements.define` guard (one-line branch).
- Shadow DOM style isolation (happy-dom is unreliable; defer to a real browser when a regression bites).
- Multi-instance fetch dedup (same reason).
- All attribute routing variations beyond `src` (`color-mode`, `rankdir`, `no-*` are thin forwarders; happy path proves the routing layer alive).
- Playwright entirely. Revisit only if a regression slips that Playwright would have caught.

## Docs

- New page `docs/content/docs/embed/_index.md` with a copy-pasteable snippet, the attribute table, the CDN URL pattern, theming examples, and the event/method reference.
- Update `README.md` "Install" section to add a `<script type="module">` example alongside the `pnpm add` examples.

## File-by-file change list

**New**

- `packages/embed/src/element.ts`
- `packages/embed/src/url-cache.ts`
- `packages/embed/src/error-ui.ts`
- `packages/embed/src/index.ts`
- `packages/embed/test/element.test.ts`
- `packages/embed/vite.config.ts`
- `packages/embed/package.json`
- `packages/embed/tsconfig.json`
- `docs/content/docs/embed/_index.md`

**Modify**

- Root `package.json` - add `build:embed` script; chain after `build:svelte`.
- `pnpm-workspace.yaml` - include `packages/embed`.
- `README.md` - add CDN install snippet.

**Depends on (must ship first)**

- `svelte-react-parity-design.md` - the 3 parity gaps and 1 cosmetic must land before the embed's `rankdir` and sub-graph nav can be claimed working.

## Risks

- **Svelte 5 custom-element compilation** is relatively new; edge cases around attribute reflection and Shadow DOM event retargeting may surface during integration. Mitigation: the three integration tests stress the surfaces hosts actually depend on (load events, error events, src reactivity), so regressions surface in test rather than production.
- **Bundle size** is dominated by parsers (~80-120 KB gzipped combined). Without lazy loading, every embed pays the full cost. Acceptable for v1 (internal-first audience tolerates the cost on cached, LAN-served bundles); revisit when public-embed traffic warrants the complexity of per-format chunks.
- **Main-thread parsing** of large models (200+ MB ONNX) briefly blocks the host page UI during the parse step. Documented in the embed docs page as a known characteristic; mitigated by the URL cache (subsequent tags re-use the parsed buffer fetch but re-parse). Worker pool is a v2 candidate if pages with many large viewers prove painful.
- **CSS custom property leakage**: the host's CSS context bleeds in through the property channel. Intentional - that's how theming works - but a host with a poorly-scoped `--wetron-*` rule could affect every embed on the page. Documented in the theming section of the embed docs.
