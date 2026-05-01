<script lang="ts">
  import type { OpCategory } from '@wetron/core';
  import {
    ArrowDown, ArrowUp, Aperture, Function, StackMinus,
    FrameCorners, PlusMinus, ArrowsMerge, Eye,
    ArrowCounterClockwise, Faders, Question,
  } from 'phosphor-svelte';

  let { cat, size = 16 }: { cat: OpCategory; size?: number } = $props();
</script>

{#if cat === 'input'}
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
  <FrameCorners {size} />
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
