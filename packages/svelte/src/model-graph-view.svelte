<script lang="ts">
  import { SvelteFlow, Controls, Background } from '@xyflow/svelte';
  import FitViewHelper from './fit-view-helper.svelte';
  import MinimapNav from './minimap-nav.svelte';
  import ExportHelper from './export-helper.svelte';
  import type { ExportHelpers } from './export-helper.svelte';
  import '@xyflow/svelte/dist/style.css';
  import { untrack } from 'svelte';
  import { modelGraphToFlow, filterGraph } from '@wetron/core';
  import type { FlowEdge, GraphNodeData } from '@wetron/core/transform';
  import type { ModelGraph, ParseWarning } from '@wetron/core/ir';
  import GraphNodeComponent from './nodes/graph-node.svelte';
  import IoNodeComponent from './nodes/io-node.svelte';
  import ModelEdgeComponent from './edges/model-edge.svelte';
  import { provideColorMode, resolveColorMode, type ColorMode } from './color-mode-context.ts';
  import type { PanelTarget } from './types.ts';
  import { CANVAS_VARS, MINIMAP_THEME, EDGE_THEME } from '@wetron/tokens';

  type FlowEdgeData = FlowEdge['data'];

  interface Props {
    graph: ModelGraph;
    onTargetClick?: (target: PanelTarget) => void;
    onWarnings?: (warnings: readonly ParseWarning[]) => void;
    selectedEdgeTensorName?: string | null;
    searchQuery?: string;
    colorMode?: ColorMode;
    exportRef?: ExportHelpers | null;
  }

  let { graph, onTargetClick, onWarnings, selectedEdgeTensorName = null, searchQuery = '', colorMode = 'system', exportRef = $bindable<ExportHelpers | null>(null) }: Props = $props();

  let systemIsDark = $state(resolveColorMode('system') === 'dark');

  $effect(() => {
    if (colorMode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    systemIsDark = mq.matches;
    const handler = (e: MediaQueryListEvent) => { systemIsDark = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  const isDark = $derived(
    colorMode === 'dark' ? true :
    colorMode === 'light' ? false :
    systemIsDark
  );

  // $state object in context - child nodes read .resolved inside $derived,
  // creating an explicit signal subscription that re-fires on theme change.
  const colorCtx: { resolved: 'light' | 'dark' } = $state({ resolved: 'light' });
  $effect.pre(() => { colorCtx.resolved = isDark ? 'dark' : 'light'; });
  provideColorMode(colorCtx);

  const nodeTypes = {
    graphNode: GraphNodeComponent,
    ioNode: IoNodeComponent,
  };

  const edgeTypes = {
    modelEdge: ModelEdgeComponent,
  };

  const edgeDefaults = $derived(
    isDark
      ? { style: 'stroke: #7a7a9a; opacity: 0.55;' }
      : { style: 'opacity: 0.35;' }
  );

  $effect(() => {
    onWarnings?.(graph.warnings ?? []);
  });

  const rawFlow = $derived(modelGraphToFlow(graph));
  const matchedNames = $derived(searchQuery ? filterGraph(graph, searchQuery) : new Set<string>());

  // $state.raw prevents @xyflow/svelte from seeing deeply-reactive proxies;
  // it mutates node objects internally (computed dims/positions) and that would
  // write back through Svelte's proxy, invalidating rawFlow -> infinite loop.
  let flowNodes = $state.raw(untrack(() => rawFlow.nodes));
  $effect.pre(() => {
    flowNodes = rawFlow.nodes;
  });

  const styledFlowNodes = $derived(
    matchedNames.size === 0
      ? flowNodes
      : flowNodes.map(n => {
          const data = n.data as GraphNodeData | undefined;
          if (!data?.graphNode) return n;
          return matchedNames.has(data.graphNode.name) ? n : { ...n, style: 'opacity: 0.1' };
        })
  );

  const flowEdges = $derived(rawFlow.edges.map(edge => {
    const d = edge.data as FlowEdgeData | undefined;
    const isSelected = selectedEdgeTensorName != null && d?.tensorName === selectedEdgeTensorName;
    const anySelected = selectedEdgeTensorName != null;
    const filtering = matchedNames.size > 0;
    const edgeDimmed = filtering && !matchedNames.has(d?.sourceNodeName ?? '') && !matchedNames.has(d?.targetNodeName ?? '');
    return {
      ...edge,
      style: isSelected
        ? `stroke: ${EDGE_THEME.selectedStroke}; stroke-width: ${EDGE_THEME.selectedStrokeWidth}; opacity: 1;`
        : anySelected
          ? `stroke: ${isDark ? 'rgba(120,120,160,0.2)' : 'rgba(0,0,0,0.1)'}; opacity: 1;`
          : edgeDimmed
            ? `stroke: ${isDark ? 'rgba(120,120,160,0.15)' : 'rgba(0,0,0,0.07)'}; opacity: 1;`
            : edgeDefaults.style,
    };
  }));

  function handleNodeClick({ node, event }: { node: { data: GraphNodeData }; event: MouseEvent | TouchEvent }) {
    if (!onTargetClick) return;
    const weightRow = (event.target as Element).closest('[data-weight-name]') as HTMLElement | null;
    if (weightRow) {
      const name = weightRow.dataset.weightName;
      const shapeStr = weightRow.dataset.weightShape;
      if (name && shapeStr) {
        onTargetClick({ tensor: { name, shape: shapeStr.split(',').map(Number), dtype: weightRow.dataset.weightDtype ?? null } });
      }
      return;
    }
    if (node.data.graphNode) {
      onTargetClick(node.data.graphNode);
    } else if (node.data.graphValue) {
      onTargetClick({ graphValue: node.data.graphValue, direction: node.data.opType === 'Input' ? 'input' : 'output' });
    }
  }

  function handleEdgeClick({ edge }: { edge: { data?: FlowEdgeData }; event: MouseEvent }) {
    if (!onTargetClick || !edge.data) return;
    const d = edge.data;
    const sameEdges = rawFlow.edges.filter(e => (e.data as FlowEdgeData | undefined)?.tensorName === d.tensorName);
    const from = { opType: d.sourceOpType, name: d.sourceNodeName };
    const to = sameEdges.map(e => ({ opType: (e.data as FlowEdgeData).targetOpType, name: (e.data as FlowEdgeData).targetNodeName }));
    onTargetClick({ edge: { tensorName: d.tensorName, from, to } });
  }
</script>

<div
  class="wetron-graph"
  data-theme={isDark ? 'dark' : 'light'}
  style={Object.entries(CANVAS_VARS[isDark ? 'dark' : 'light']).map(([k, v]) => `${k}:${v}`).join(';')}
>
  <SvelteFlow
    nodes={styledFlowNodes}
    edges={flowEdges}
    {nodeTypes}
    {edgeTypes}
    onnodeclick={handleNodeClick}
    onedgeclick={handleEdgeClick}
    nodesConnectable={false}
    nodesDraggable={false}
    panOnScroll
    zoomOnScroll={false}
    zoomOnDoubleClick={false}
    zoomActivationKey="Meta"
    minZoom={0.05}
    colorMode={isDark ? 'dark' : 'light'}
    onlyRenderVisibleElements
    proOptions={{ hideAttribution: true }}
  >
    <MinimapNav
      style={`background: ${isDark ? MINIMAP_THEME.dark.background : MINIMAP_THEME.light.background}; border-radius: ${MINIMAP_THEME.borderRadius}px; border: none; overflow: hidden; cursor: crosshair;`}
      nodeColor={isDark ? MINIMAP_THEME.dark.nodeColor : MINIMAP_THEME.light.nodeColor}
      maskColor={isDark ? MINIMAP_THEME.dark.maskColor : MINIMAP_THEME.light.maskColor}
    />
    <Controls />
    <Background patternColor={isDark ? '#2a2a3a' : '#d0d0d8'} />
    <FitViewHelper nodes={flowNodes} />
    <ExportHelper bind:ref={exportRef} />
  </SvelteFlow>
</div>

<style>
  .wetron-graph {
    all: revert;
    width: 100%;
    height: 100%;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    box-sizing: border-box;
  }

  /* ── Handles ── */
  :global(.wetron-graph .svelte-flow__handle) {
    width: 6px;
    height: 6px;
    min-width: 6px;
    min-height: 6px;
  }

  /* ── Controls ── */
  :global(.wetron-graph .svelte-flow__controls) {
    box-shadow: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  :global(.wetron-graph .svelte-flow__controls-button) {
    border-radius: 4px;
    border-bottom: none;
  }

  /* ── Dark theme ── */
  :global(.wetron-graph[data-theme="dark"] .svelte-flow) {
    background-color: #13131f;
  }

  :global(.wetron-graph[data-theme="dark"] .svelte-flow__controls-button) {
    background-color: #1e1e2e;
    border-color: #2a2a3a;
    color: #7a7a9a;
  }

  :global(.wetron-graph[data-theme="dark"] .svelte-flow__controls-button:hover) {
    background-color: #252538;
    color: #a0a0c0;
  }

  :global(.wetron-graph[data-theme="dark"] .svelte-flow__controls-button svg) {
    fill: #7a7a9a;
  }

  :global(.wetron-graph[data-theme="dark"] .svelte-flow__controls-button:hover svg) {
    fill: #a0a0c0;
  }

  /* ── Light theme ── */
  :global(.wetron-graph[data-theme="light"] .svelte-flow) {
    background-color: #f8f8fc;
  }

  :global(.wetron-graph[data-theme="light"] .svelte-flow__controls-button) {
    background-color: #ffffff;
    border-color: #e0e0e0;
    color: #555;
  }

  :global(.wetron-graph[data-theme="light"] .svelte-flow__controls-button:hover) {
    background-color: #f0f0f8;
    color: #333;
  }

  :global(.wetron-graph[data-theme="dark"]) {
    --wetron-category-input:         #4caf50;
    --wetron-category-output:        #42a5f5;
    --wetron-category-conv:          #7986cb;
    --wetron-category-activation:    #ef5350;
    --wetron-category-normalization: #26a69a;
    --wetron-category-pooling:       #ab47bc;
    --wetron-category-reshape:       #90a4ae;
    --wetron-category-math:          #ce93d8;
    --wetron-category-reduction:     #64b5f6;
    --wetron-category-merge:         #9fa8da;
    --wetron-category-attention:     #4db6ac;
    --wetron-category-recurrent:     #aed581;
    --wetron-category-quantization:  #bcaaa4;
    --wetron-category-constant:      #4fc3f7;
    --wetron-category-logic:         #4dd0e1;
    --wetron-category-unknown:       #9e9e9e;
  }

  :global(.wetron-graph[data-theme="light"]) {
    --wetron-category-input:         #2e7d32;
    --wetron-category-output:        #1565c0;
    --wetron-category-conv:          #3949ab;
    --wetron-category-activation:    #c0392b;
    --wetron-category-normalization: #00695c;
    --wetron-category-pooling:       #6a1b9a;
    --wetron-category-reshape:       #546e7a;
    --wetron-category-math:          #7b1fa2;
    --wetron-category-reduction:     #0277bd;
    --wetron-category-merge:         #5c6bc0;
    --wetron-category-attention:     #00695c;
    --wetron-category-recurrent:     #558b2f;
    --wetron-category-quantization:  #795548;
    --wetron-category-constant:      #0277bd;
    --wetron-category-logic:         #00838f;
    --wetron-category-unknown:       #757575;
  }

  /* ── Node defaults - remove XY Flow's default border/shadow on nodes ── */
  :global(.wetron-graph .svelte-flow__node) {
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    padding: 0;
    font-size: inherit;
  }
</style>
