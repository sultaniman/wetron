<script lang="ts">
  import type { OpCategory } from '@wetron/core';
  import {
    ArrowDownIcon, ArrowUpIcon, ApertureIcon, FunctionIcon, StackMinusIcon,
    CubeIcon, PlusMinusIcon, ArrowsMergeIcon, EyeIcon,
    ArrowCounterClockwiseIcon, FadersIcon, QuestionIcon, DiamondIcon,
    // per-op overrides
    ArrowsOutSimpleIcon, ArrowsOutLineVerticalIcon, ArrowsInLineVerticalIcon, ScissorsIcon,
    ArrowsDownUpIcon, RowsIcon, BoundingBoxIcon, FrameCornersIcon,
    DotsNineIcon, CopySimpleIcon, ArrowsSplitIcon, FunnelSimpleIcon, TableIcon,
    StackIcon,
  } from 'phosphor-svelte';

  let { cat, op, size = 16 }: { cat: OpCategory; op?: string; size?: number } = $props();
</script>

{#if op === 'Reshape'}
  <BoundingBoxIcon {size} />
{:else if op === 'Expand'}
  <ArrowsOutSimpleIcon {size} />
{:else if op === 'Unsqueeze'}
  <ArrowsOutLineVerticalIcon {size} />
{:else if op === 'Squeeze'}
  <ArrowsInLineVerticalIcon {size} />
{:else if op === 'Slice'}
  <StackIcon {size} />
{:else if op === 'Transpose'}
  <ArrowsDownUpIcon {size} />
{:else if op === 'Flatten'}
  <RowsIcon {size} />
{:else if op === 'Pad'}
  <FrameCornersIcon {size} />
{:else if op === 'ScatterElements' || op === 'ScatterND'}
  <DotsNineIcon {size} />
{:else if op === 'Tile'}
  <CopySimpleIcon {size} />
{:else if op === 'Split'}
  <ArrowsSplitIcon {size} />
{:else if op === 'Gather' || op === 'GatherElements' || op === 'GatherND'}
  <FunnelSimpleIcon {size} />
{:else if op === 'Add'}
  <span class="glyph">+</span>
{:else if op === 'Sub'}
  <span class="glyph">−</span>
{:else if op === 'Mul'}
  <span class="glyph">×</span>
{:else if op === 'Div'}
  <span class="glyph">÷</span>
{:else if op === 'Clip'}
  <ScissorsIcon {size} />
{:else if op === 'Not'}
  <span class="glyph">!</span>
{:else if op === 'MatMul' || op === 'Gemm'}
  <TableIcon {size} />
{:else if cat === 'input'}
  <ArrowDownIcon {size} />
{:else if cat === 'output'}
  <ArrowUpIcon {size} />
{:else if cat === 'conv'}
  <ApertureIcon {size} />
{:else if cat === 'activation'}
  <FunctionIcon {size} />
{:else if cat === 'normalization'}
  <span class="glyph">μ</span>
{:else if cat === 'pooling'}
  <StackMinusIcon {size} />
{:else if cat === 'reshape'}
  <CubeIcon {size} />
{:else if cat === 'math'}
  <PlusMinusIcon {size} />
{:else if cat === 'reduction'}
  <span class="glyph">Σ</span>
{:else if cat === 'merge'}
  <ArrowsMergeIcon {size} />
{:else if cat === 'attention'}
  <EyeIcon {size} />
{:else if cat === 'recurrent'}
  <ArrowCounterClockwiseIcon {size} />
{:else if cat === 'quantization'}
  <FadersIcon {size} />
{:else if cat === 'constant'}
  <DiamondIcon {size} />
{:else if cat === 'logic'}
  <span class="glyph">=</span>
{:else}
  <QuestionIcon {size} />
{/if}

<style>
  .glyph {
    font-family: monospace;
    font-size: 16px;
    line-height: 1;
  }
</style>
