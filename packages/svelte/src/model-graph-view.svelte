<script lang="ts">
  import { SvelteFlow, MiniMap, Controls, Background } from '@xyflow/svelte';
  import FitViewHelper from './fit-view-helper.svelte';
  import '@xyflow/svelte/dist/style.css';
  import { setContext } from 'svelte';
  import { modelGraphToFlow } from '@wetron/core/transform';
  import type { ModelGraph } from '@wetron/core/ir';
  import type { GraphNodeData } from '@wetron/core/transform';
  import GraphNodeComponent from './nodes/graph-node.svelte';
  import IoNodeComponent from './nodes/io-node.svelte';
  import ModelEdgeComponent from './edges/model-edge.svelte';
  import { provideColorMode, resolveColorMode, type ColorMode } from './color-mode-context.ts';
  import type { PanelTarget } from './types.ts';
  import { CANVAS_VARS, MINIMAP_THEME, EDGE_THEME } from '@wetron/tokens';

  type FlowEdgeData = {
    tensorName: string;
    sourceOpType: string;
    sourceNodeName: string;
    targetOpType: string;
    targetNodeName: string;
  };

  interface Props {
    graph: ModelGraph;
    onTargetClick?: (target: PanelTarget) => void;
    selectedEdgeTensorName?: string | null;
    colorMode?: ColorMode;
  }

  let { graph, onTargetClick, selectedEdgeTensorName = null, colorMode = 'system' }: Props = $props();

  setContext('wetron:onTargetClick', () => onTargetClick);

  const isDark = $derived(resolveColorMode(colorMode) === 'dark');
  provideColorMode(() => isDark ? 'dark' : 'light');

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

  const rawFlow = $derived(modelGraphToFlow(graph));

  // $state.raw prevents @xyflow/svelte from seeing deeply-reactive proxies;
  // it mutates node objects internally (computed dims/positions) and that would
  // write back through Svelte's proxy, invalidating rawFlow → infinite loop.
  let flowNodes = $state.raw(rawFlow.nodes);
  $effect.pre(() => {
    flowNodes = rawFlow.nodes;
  });

  const flowEdges = $derived(rawFlow.edges.map(edge => {
    const tensorName = (edge.data as FlowEdgeData | undefined)?.tensorName;
    const isSelected = selectedEdgeTensorName != null && tensorName === selectedEdgeTensorName;
    const anySelected = selectedEdgeTensorName != null;
    return {
      ...edge,
      style: isSelected
        ? `stroke: ${EDGE_THEME.selectedStroke}; stroke-width: ${EDGE_THEME.selectedStrokeWidth}; opacity: 1;`
        : anySelected
          ? `stroke: ${isDark ? 'rgba(120,120,160,0.2)' : 'rgba(0,0,0,0.1)'}; opacity: 1;`
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
    nodes={flowNodes}
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
    proOptions={{ hideAttribution: true }}
  >
    <MiniMap
      style={`background: ${isDark ? MINIMAP_THEME.dark.background : MINIMAP_THEME.light.background}; border-radius: ${MINIMAP_THEME.borderRadius}px; border: none; overflow: hidden;`}
      nodeColor={isDark ? MINIMAP_THEME.dark.nodeColor : MINIMAP_THEME.light.nodeColor}
      maskColor={isDark ? MINIMAP_THEME.dark.maskColor : MINIMAP_THEME.light.maskColor}
    />
    <Controls />
    <Background bgColor={isDark ? '#2a2a3a' : '#d0d0d8'} />
    <FitViewHelper nodes={flowNodes} />
  </SvelteFlow>
</div>

<style>
  .wetron-graph {
    width: 100%;
    height: 100%;
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

  /* ── Node defaults — remove XY Flow's default border/shadow on nodes ── */
  :global(.wetron-graph .svelte-flow__node) {
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    padding: 0;
    font-size: inherit;
  }
</style>
