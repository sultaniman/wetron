<script lang="ts">
  import { ArrowUpIcon } from 'phosphor-svelte';
  import { parseModel } from '@wetron/core';
  import type { ModelGraph } from '@wetron/core';
  import { ModelGraphView, NodePropertyPanel } from '@wetron/svelte';
  import type { PanelTarget, ColorMode } from '@wetron/svelte';

  type AppState =
    | { status: 'idle' }
    | { status: 'loading'; name: string }
    | { status: 'ready'; name: string }
    | { status: 'error'; message: string; name: string };

  const MODE_CYCLE: ColorMode[] = ['system', 'light', 'dark'];
  const MODE_LABEL: Record<ColorMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

  let appState = $state<AppState>({ status: 'idle' });
  // $state.raw so the parsed graph is never wrapped in a deep-reactive proxy;
  // SvelteFlow mutates node objects internally and would trigger an infinite loop otherwise.
  let graph = $state.raw<ModelGraph | null>(null);
  let dragging = $state(false);
  let selected = $state<PanelTarget | null>(null);
  let history = $state<PanelTarget[]>([]);
  let selectedEdgeTensorName = $state<string | null>(null);
  let colorMode = $state<ColorMode>('system');

  function resolveMode(mode: ColorMode): 'light' | 'dark' {
    if (mode !== 'system') return mode;
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    catch { return 'light'; }
  }

  let isDark = $derived(resolveMode(colorMode) === 'dark');

  const chrome = $derived({
    bg: isDark ? '#16161e' : '#fff',
    border: isDark ? '#2a2a3a' : '#e0e0e0',
    text: isDark ? '#e0e0e0' : '#333',
    muted: isDark ? '#888' : '#666',
    faint: isDark ? '#666' : '#888',
    pageBg: isDark ? '#0f0f17' : '#f5f5f5',
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

  function cycleMode() {
    colorMode = MODE_CYCLE[(MODE_CYCLE.indexOf(colorMode) + 1) % MODE_CYCLE.length];
  }

  async function loadFile(file: File) {
    appState = { status: 'loading', name: file.name };
    graph = null;
    selected = null;
    history = [];
    selectedEdgeTensorName = null;
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseModel(new Uint8Array(buf), file.name);
      graph = parsed;
      appState = { status: 'ready', name: file.name };
    } catch (e) {
      appState = { status: 'error', message: e instanceof Error ? e.message : String(e), name: file.name };
    }
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
</script>

<div style="display:flex;flex-direction:column;height:100vh;background:{chrome.pageBg}">
  <header style="padding:12px 20px;background:{chrome.bg};border-bottom:1px solid {chrome.border};display:flex;align-items:center;gap:16px;flex-shrink:0">
    <span style="font-weight:700;font-size:18px;color:{chrome.text}">wetron</span>
    {#if appState.status !== 'idle'}
      <span style="color:{chrome.muted};font-size:14px">{appState.name}</span>
    {/if}
    {#if appState.status === 'ready' && graph}
      <span style="color:{chrome.faint};font-size:13px">
        {graph.nodes.length} nodes · {graph.inputs.length} inputs · {graph.outputs.length} outputs
      </span>
    {/if}
    <button
      onclick={cycleMode}
      style="margin-left:auto;padding:5px 12px;background:transparent;color:{chrome.muted};border:1px solid {chrome.border};border-radius:6px;cursor:pointer;font-size:12px;font-weight:500"
    >
      {MODE_LABEL[colorMode]}
    </button>
    <label style="padding:6px 14px;background:#1a73e8;color:#fff;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">
      Open model
      <input type="file" accept=".onnx,.tflite,.keras" style="display:none" onchange={onFileChange} />
    </label>
  </header>

  <main style="flex:1;position:relative;overflow:hidden">
    {#if appState.status === 'idle'}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        ondrop={onDrop}
        ondragover={(e) => { e.preventDefault(); dragging = true; }}
        ondragleave={() => dragging = false}
        style="
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          height:100%;gap:12px;
          border:2px dashed {dragging ? '#1a73e8' : isDark ? '#333' : '#ccc'};
          margin:24px;border-radius:12px;
          background:{dragging ? (isDark ? '#1a2a4a' : '#e8f0fe') : isDark ? '#1a1a2a' : '#fafafa'};
          transition:all 0.15s
        "
      >
        <div style="color:{isDark ? '#e0e0e0' : '#333'}"><ArrowUpIcon size={48} /></div>
        <div style="font-weight:600;color:{isDark ? '#e0e0e0' : '#333'}">Drop a model file here</div>
        <div style="color:#888;font-size:13px">Supports .onnx, .tflite and .keras</div>
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
          {colorMode}
        />

        {#if selected !== null}
          <div style="position:absolute;top:16px;right:16px;width:280px;z-index:10;max-height:calc(100% - 32px);overflow-y:auto;border-radius:8px;">
            <NodePropertyPanel
              target={selected}
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
