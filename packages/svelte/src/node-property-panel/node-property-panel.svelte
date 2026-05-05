<script lang="ts">
  import { resolveColorMode, type ColorMode } from '../color-mode-context.ts';
  import type { PanelTarget, GraphNode, GraphValue } from '@wetron/core/ir';
  import { PANEL_VARS } from '@wetron/tokens';
  import OpPanel from './op-panel.svelte';
  import IoPanel from './io-panel.svelte';
  import EdgePanel from './edge-panel.svelte';
  import TensorPanel from './tensor-panel.svelte';
  import CloseButton from './close-button.svelte';

  type TensorInfo = { readonly shape: readonly number[] | null; readonly dtype: string | null };

  let { target, onTensorClick, onBack, onClose, colorMode, inputSources, tensorShapes, opsets }: {
    target: PanelTarget | null;
    onTensorClick?: (name: string) => void;
    onBack?: () => void;
    onClose?: () => void;
    colorMode?: ColorMode;
    inputSources?: ReadonlyMap<string, string>;
    tensorShapes?: ReadonlyMap<string, TensorInfo>;
    opsets?: ReadonlyMap<string, number>;
  } = $props();

  let systemIsDark = $state(resolveColorMode('system') === 'dark');

  $effect(() => {
    const mode = colorMode ?? 'system';
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    systemIsDark = mq.matches;
    const handler = (e: MediaQueryListEvent) => { systemIsDark = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  const isDark = $derived(
    (colorMode ?? 'system') === 'dark' ? true :
    (colorMode ?? 'system') === 'light' ? false :
    systemIsDark
  );
  const theme = $derived(isDark ? 'dark' : 'light');

  function isGraphNode(t: PanelTarget): t is GraphNode {
    return 'opType' in t;
  }
  function isEdgeTarget(t: PanelTarget): t is { edge: { tensorName: string; from: { opType: string; name: string }; to: Array<{ opType: string; name: string }> } } {
    return 'edge' in t;
  }
  function isTensorTarget(t: PanelTarget): t is { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } } {
    return 'tensor' in t;
  }
  function isIoTarget(t: PanelTarget): t is { graphValue: GraphValue; direction: 'input' | 'output' } {
    return 'graphValue' in t;
  }
</script>

{#if target}
  <div
    class="panel"
    data-theme={theme}
    style={Object.entries(PANEL_VARS[isDark ? 'dark' : 'light']).map(([k, v]) => `${k}:${v}`).join(';')}
  >
    {#if onClose}<CloseButton {onClose} />{/if}
    {#if isGraphNode(target)}
      <OpPanel node={target} {inputSources} {onTensorClick} {onBack} {opsets} />
    {:else if isEdgeTarget(target)}
      <EdgePanel edge={target.edge} {tensorShapes} {onBack} />
    {:else if isTensorTarget(target)}
      <TensorPanel tensor={target.tensor} {onBack} />
    {:else if isIoTarget(target)}
      <IoPanel graphValue={target.graphValue} direction={target.direction} {onBack} />
    {/if}
  </div>
{/if}

<style>
  .panel {
    position: relative;
    width: 260px;
    background: var(--panel-bg);
    border-radius: 8px;
    overflow: hidden;
    font-family: system-ui, sans-serif;
    font-size: 11px;
    border: 1px solid var(--panel-border);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.10);
    color: var(--panel-text);
  }

  :global(.panel[data-theme="dark"]) {
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

  :global(.panel[data-theme="light"]) {
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
</style>
