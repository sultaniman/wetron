<script lang="ts">
  import type { OpCategory } from '@wetron/core';
  import {
    ArrowDown, ArrowUp, Aperture, Function, StackMinus,
    Cube, PlusMinus, ArrowsMerge, Eye,
    ArrowCounterClockwise, Faders, Question, Diamond,
    // per-op overrides
    ArrowsOutSimple, ArrowsOutLineVertical, ArrowsInLineVertical, Scissors,
    ArrowsDownUp, Rows, BoundingBox, FrameCorners,
    DotsNine, CopySimple, ArrowsSplit, FunnelSimple, Table,
    Stack,
  } from 'phosphor-svelte';

  let { cat, op, size = 16 }: { cat: OpCategory; op?: string; size?: number } = $props();
</script>

{#if op === 'Reshape'}
  <BoundingBox {size} />
{:else if op === 'Expand'}
  <ArrowsOutSimple {size} />
{:else if op === 'Unsqueeze'}
  <ArrowsOutLineVertical {size} />
{:else if op === 'Squeeze'}
  <ArrowsInLineVertical {size} />
{:else if op === 'Slice'}
  <Stack {size} />
{:else if op === 'Transpose'}
  <ArrowsDownUp {size} />
{:else if op === 'Flatten'}
  <Rows {size} />
{:else if op === 'Pad'}
  <FrameCorners {size} />
{:else if op === 'ScatterElements' || op === 'ScatterND'}
  <DotsNine {size} />
{:else if op === 'Tile'}
  <CopySimple {size} />
{:else if op === 'Split'}
  <ArrowsSplit {size} />
{:else if op === 'Gather' || op === 'GatherElements' || op === 'GatherND'}
  <FunnelSimple {size} />
{:else if op === 'Add'}
  <span class="glyph">+</span>
{:else if op === 'Sub'}
  <span class="glyph">−</span>
{:else if op === 'Mul'}
  <span class="glyph">×</span>
{:else if op === 'Div'}
  <span class="glyph">÷</span>
{:else if op === 'Clip'}
  <Scissors {size} />
{:else if op === 'Not'}
  <span class="glyph">!</span>
{:else if op === 'MatMul' || op === 'Gemm'}
  <Table {size} />
{:else if cat === 'input'}
  <ArrowDown {size} />
{:else if cat === 'output'}
  <ArrowUp {size} />
{:else if cat === 'conv'}
  <Aperture {size} />
{:else if cat === 'activation'}
  <Function {size} />
{:else if cat === 'normalization'}
  <span class="glyph">μ</span>
{:else if cat === 'pooling'}
  <StackMinus {size} />
{:else if cat === 'reshape'}
  <Cube {size} />
{:else if cat === 'math'}
  <PlusMinus {size} />
{:else if cat === 'reduction'}
  <span class="glyph">Σ</span>
{:else if cat === 'merge'}
  <ArrowsMerge {size} />
{:else if cat === 'attention'}
  <Eye {size} />
{:else if cat === 'recurrent'}
  <ArrowCounterClockwise {size} />
{:else if cat === 'quantization'}
  <Faders {size} />
{:else if cat === 'constant'}
  <Diamond {size} />
{:else if cat === 'logic'}
  <span class="glyph">=</span>
{:else}
  <Question {size} />
{/if}

<style>
  .glyph {
    font-family: monospace;
    font-size: 16px;
    line-height: 1;
  }
</style>
