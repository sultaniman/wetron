<script lang="ts">
  import { SunIcon, MoonIcon, DesktopIcon } from 'phosphor-svelte';
  import { toPng } from 'html-to-image';
  import { getViewportForBounds } from '@xyflow/svelte';
  import { parseModel } from '@wetron/core';
  import type { ModelGraph } from '@wetron/core';
  import { loadSavedModelWeights, attachCheckpointToGraph } from '@wetron/savedmodel';
  import { ModelGraphView, NodePropertyPanel } from '@wetron/svelte';
  import type { PanelTarget, ColorMode, ExportHelpers } from '@wetron/svelte';

  type WeightsLoad =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string };

  type AppState =
    | { status: 'idle' }
    | { status: 'loading'; name: string }
    | { status: 'ready'; name: string }
    | { status: 'error'; message: string; name: string };

  const MODE_CYCLE: ColorMode[] = ['system', 'light', 'dark'];
  const MODE_LABEL: Record<ColorMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };
  const MODE_ICON: Record<ColorMode, typeof SunIcon> = {
    system: DesktopIcon,
    light: SunIcon,
    dark: MoonIcon,
  };

  let appState = $state<AppState>({ status: 'idle' });
  let graphExport = $state<ExportHelpers | null>(null);
  // $state.raw so the parsed graph is never wrapped in a deep-reactive proxy;
  // SvelteFlow mutates node objects internally and would trigger an infinite loop otherwise.
  let graph = $state.raw<ModelGraph | null>(null);
  let dragging = $state(false);
  let selected = $state<PanelTarget | null>(null);
  let history = $state<PanelTarget[]>([]);
  let selectedEdgeTensorName = $state<string | null>(null);
  let colorMode = $state<ColorMode>('system');
  let searchQuery = $state('');
  let weightsLoad = $state<WeightsLoad>({ status: 'idle' });

  let systemIsDark = $state(
    (() => { try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } })()
  );

  $effect(() => {
    if (colorMode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    systemIsDark = mq.matches;
    const handler = (e: MediaQueryListEvent) => { systemIsDark = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  const isDark = $derived(
    colorMode === 'dark' ? true : colorMode === 'light' ? false : systemIsDark
  );

  const chrome = $derived({
    bg: isDark ? '#16161e' : '#fff',
    border: isDark ? '#2a2a3a' : '#e0e0e0',
    text: isDark ? '#e0e0e0' : '#333',
    muted: isDark ? '#888' : '#666',
    faint: isDark ? '#666' : '#888',
    pageBg: isDark ? '#0f0f17' : '#f5f5f5',
    headline: isDark ? '#ececf1' : '#1a1a1f',
    sub: isDark ? '#9ea0aa' : '#5b6270',
    dragBg: isDark ? 'rgba(26,115,232,0.12)' : 'rgba(26,115,232,0.06)',
  });

  const tensorSources = $derived.by(() => {
    if (appState.status !== 'ready' || !graph) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const node of graph.nodes) {
      for (const out of node.outputs) {
        if (out) map.set(out, node.opType);
      }
    }
    for (const gv of graph.inputs) {
      map.set(gv.name, 'Input');
    }
    return map;
  });

  const tensorShapes = $derived(appState.status === 'ready' && graph ? graph.tensorShapes : undefined);

  const ModeIcon = $derived(MODE_ICON[colorMode]);

  function cycleMode() {
    colorMode = MODE_CYCLE[(MODE_CYCLE.indexOf(colorMode) + 1) % MODE_CYCLE.length];
  }

  async function loadFile(file: File) {
    appState = { status: 'loading', name: file.name };
    graph = null;
    selected = null;
    history = [];
    selectedEdgeTensorName = null;
    searchQuery = '';
    weightsLoad = { status: 'idle' };
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseModel(new Uint8Array(buf), file.name);
      graph = parsed;
      appState = { status: 'ready', name: file.name };
    } catch (e) {
      appState = { status: 'error', message: e instanceof Error ? e.message : String(e), name: file.name };
    }
  }

  async function loadWeights(files: FileList) {
    const list = Array.from(files);
    const indexFile = list.find((f) => f.name.endsWith('.index'));
    const dataFile = list.find((f) => /\.data-\d{5}-of-\d{5}$/.test(f.name));
    if (!indexFile || !dataFile) {
      weightsLoad = {
        status: 'error',
        message: 'Pick both files: variables.index and variables.data-00000-of-00001',
      };
      return;
    }
    weightsLoad = { status: 'loading' };
    try {
      const loaded = await loadSavedModelWeights(indexFile, dataFile);
      if (graph) graph = attachCheckpointToGraph(graph, loaded);
      weightsLoad = { status: 'idle' };
    } catch (e) {
      weightsLoad = { status: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  }

  function onWeightsChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) loadWeights(target.files);
    target.value = '';
  }

  function handleTargetClick(target: PanelTarget) {
    history = [];
    selected = target;
    selectedEdgeTensorName = 'edge' in target ? target.edge.tensorName : null;
  }

  function handleClose() {
    selected = null;
    selectedEdgeTensorName = null;
    history = [];
  }

  function handleBack() {
    const prev = history[history.length - 1];
    if (prev !== undefined) {
      selected = prev;
      selectedEdgeTensorName = 'edge' in prev ? prev.edge.tensorName : null;
    }
    history = history.slice(0, -1);
  }

  function handleTensorClick(name: string) {
    if (appState.status !== 'ready' || !graph) return;
    const info = graph.tensorShapes.get(name);
    if (selected) history = [...history, selected];
    selected = { tensor: { name, shape: info?.shape ?? null, dtype: info?.dtype ?? null } };
    selectedEdgeTensorName = null;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) loadFile(file);
  }

  function onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) loadFile(file);
  }

  async function exportPng() {
    if (!graphExport || appState.status !== 'ready') return;
    const name = (appState as { name: string }).name.replace(/\.[^.]+$/, '') || 'graph';
    const saved = graphExport.getViewport();
    await graphExport.fitAll();
    const el = graphExport.getViewportElement();
    if (!el) return;
    const bounds = graphExport.getNodesBounds();
    const PAD = 60;
    const imgW = Math.ceil(bounds.width + PAD * 2);
    const imgH = Math.ceil(bounds.height + PAD * 2);
    const vp = getViewportForBounds(bounds, imgW, imgH, 0.1, 4, PAD / Math.max(bounds.width, bounds.height));
    const dataUrl = await toPng(el, {
      cacheBust: true,
      pixelRatio: 2,
      width: imgW,
      height: imgH,
      style: {
        width: `${imgW}px`,
        height: `${imgH}px`,
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
      },
    });
    graphExport.setViewport(saved);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${name}.png`;
    a.click();
  }
</script>

{#snippet brandMark(size: number)}
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="#1a73e8" />
    <path d="M14 18 L24 48 L32 30 L40 48 L50 18" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
{/snippet}

<div style="display:flex;flex-direction:column;height:100vh;background:{chrome.pageBg}">
  <header style="padding:12px 20px;background:{chrome.bg};border-bottom:1px solid {chrome.border};display:flex;align-items:center;gap:16px;flex-shrink:0">
    <a href="/" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:{chrome.text}">
      {@render brandMark(22)}
      <span style="font-weight:700;font-size:18px;letter-spacing:-0.01em">wetron</span>
    </a>
    {#if appState.status !== 'idle'}
      <span style="color:{chrome.muted};font-size:14px">{appState.name}</span>
    {/if}
    {#if appState.status === 'ready' && graph}
      <span style="color:{chrome.faint};font-size:13px">
        {graph.nodes.length} nodes · {graph.inputs.length} inputs · {graph.outputs.length} outputs
      </span>
    {/if}
    {#if appState.status === 'ready'}
      <input
        type="search"
        placeholder="Search ops…"
        bind:value={searchQuery}
        style="margin-left:auto;padding:5px 10px;background:transparent;color:{chrome.text};border:1px solid {chrome.border};border-radius:6px;font-size:13px;outline:none;width:180px"
      />
      <button
        onclick={exportPng}
        style="padding:5px 12px;background:transparent;color:{chrome.muted};border:1px solid {chrome.border};border-radius:6px;cursor:pointer;font-size:12px;font-weight:500"
      >
        Export PNG
      </button>
    {/if}
    {#if appState.status === 'ready' && graph && graph.hasExternalWeights && !graph.weights}
      <label
        title="Pick variables.index + variables.data-XXXXX-of-XXXXX from the SavedModel directory"
        style="padding:5px 12px;background:{weightsLoad.status === 'loading' ? chrome.faint : 'transparent'};color:{weightsLoad.status === 'error' ? '#d93025' : chrome.muted};border:1px solid {weightsLoad.status === 'error' ? '#d93025' : chrome.border};border-radius:6px;cursor:{weightsLoad.status === 'loading' ? 'wait' : 'pointer'};font-size:12px;font-weight:500"
      >
        {weightsLoad.status === 'loading'
          ? 'Loading…'
          : weightsLoad.status === 'error'
            ? `Weights: ${weightsLoad.message}`
            : 'Load weights…'}
        <input
          type="file"
          multiple
          style="display:none"
          onchange={onWeightsChange}
          disabled={weightsLoad.status === 'loading'}
        />
      </label>
    {/if}
    {#if appState.status === 'ready' && graph && graph.weights}
      <span
        style="padding:5px 10px;color:{chrome.muted};font-size:12px"
        title="{graph.weights.totalBytes.toLocaleString()} bytes loaded"
      >
        ✓ weights loaded
      </span>
    {/if}
    <label style="{appState.status !== 'ready' ? 'margin-left:auto;' : ''}padding:6px 14px;background:#1a73e8;color:#fff;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">
      Open model
      <input type="file" accept=".onnx,.tflite,.keras,.pb,.pte,.pt" style="display:none" onchange={onFileChange} />
    </label>
    <button
      onclick={cycleMode}
      title="Theme: {MODE_LABEL[colorMode]}"
      aria-label="Theme: {MODE_LABEL[colorMode]}"
      style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;background:transparent;color:{chrome.muted};border:none;border-radius:6px;cursor:pointer"
    >
      <ModeIcon size={16} weight="regular" />
    </button>
  </header>

  <main style="flex:1;position:relative;overflow:hidden">
    {#if appState.status === 'idle'}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        ondrop={onDrop}
        ondragover={(e) => { e.preventDefault(); dragging = true; }}
        ondragleave={() => dragging = false}
        style="
          position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;
          height:100%;gap:14px;
          background:{dragging ? chrome.dragBg : 'transparent'};
          box-shadow:{dragging ? 'inset 0 0 0 2px rgba(26,115,232,0.55)' : 'none'};
          transition:background 0.15s, box-shadow 0.15s
        "
      >
        {@render brandMark(64)}
        <div style="margin-top:4px;font-weight:600;font-size:22px;letter-spacing:-0.01em;color:{chrome.headline}">
          Open a neural network model
        </div>
        <div style="color:{chrome.sub};font-size:13px">
          Supports .onnx, .tflite, .keras, .pt, .pte and .pb
        </div>
        <label style="margin-top:8px;padding:9px 20px;background:#1a73e8;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;box-shadow:0 1px 2px rgba(26,115,232,0.25)">
          Open model
          <input type="file" accept=".onnx,.tflite,.keras,.pte,.pt,.pb" style="display:none" onchange={onFileChange} />
        </label>
        <div style="color:{chrome.faint};font-size:12px">or drop a file here</div>
      </div>
    {:else if appState.status === 'loading'}
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:{chrome.muted}">
        Parsing {appState.name}...
      </div>
    {:else if appState.status === 'error'}
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px">
        <div style="color:#d93025;font-weight:600">Failed to parse {appState.name}</div>
        <div style="color:{chrome.muted};font-size:13px;max-width:480px;text-align:center">{appState.message}</div>
      </div>
    {:else if appState.status === 'ready' && graph}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        style="position:relative;width:100%;height:100%"
        ondrop={onDrop}
        ondragover={(e) => { e.preventDefault(); dragging = true; }}
        ondragleave={() => dragging = false}
      >
        <ModelGraphView
          {graph}
          onTargetClick={handleTargetClick}
          {selectedEdgeTensorName}
          {searchQuery}
          {colorMode}
          bind:exportRef={graphExport}
        />

        {#if selected !== null}
          <div style="position:absolute;top:16px;right:16px;width:320px;z-index:10;max-height:calc(100% - 32px);overflow-y:auto;border-radius:8px;">
            <NodePropertyPanel
              target={selected}
              {graph}
              {colorMode}
              inputSources={tensorSources}
              {tensorShapes}
              onTensorClick={handleTensorClick}
              onBack={history.length > 0 ? handleBack : undefined}
              onClose={handleClose}
            />
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>
