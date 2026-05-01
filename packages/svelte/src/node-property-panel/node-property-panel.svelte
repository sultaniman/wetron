<script lang="ts">
  import { resolveColorMode, type ColorMode } from '../color-mode-context.ts';
  import type { PanelTarget } from '../types.ts';
  import type { GraphNode, GraphValue } from '@wetron/core/ir';
  import { PANEL_VARS } from '@wetron/tokens';
  import OpPanel from './op-panel.svelte';
  import IoPanel from './io-panel.svelte';
  import EdgePanel from './edge-panel.svelte';
  import TensorPanel from './tensor-panel.svelte';
  import CloseButton from './close-button.svelte';

  type TensorInfo = { readonly shape: readonly number[] | null; readonly dtype: string | null };

  let { target, onTensorClick, onBack, onClose, colorMode, inputSources, tensorShapes }: {
    target: PanelTarget | null;
    onTensorClick?: (name: string) => void;
    onBack?: () => void;
    onClose?: () => void;
    colorMode?: ColorMode;
    inputSources?: ReadonlyMap<string, string>;
    tensorShapes?: ReadonlyMap<string, TensorInfo>;
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
      <OpPanel node={target} {isDark} {inputSources} {onTensorClick} {onBack} />
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
    background: var(--panel-bg);
    border-radius: 8px;
    overflow: hidden;
    font-family: system-ui, sans-serif;
    font-size: 11px;
    border: 1px solid var(--panel-border);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.10);
    color: var(--panel-text);
  }
</style>
