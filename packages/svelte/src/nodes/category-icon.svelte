<script lang="ts">
  import type { OpCategory } from '@wetron/core';
  import {
    ArrowDownIcon, ArrowUpIcon, ApertureIcon, FunctionIcon, StackMinusIcon,
    CubeIcon, PlusMinusIcon, ArrowsMergeIcon, EyeIcon,
    ArrowCounterClockwiseIcon, FadersIcon, QuestionIcon, DiamondIcon,
    SigmaIcon, EqualsIcon, ExclamationMarkIcon,
    // per-op overrides
    ArrowsOutSimpleIcon, ArrowsOutLineVerticalIcon, ArrowsInLineVerticalIcon, ScissorsIcon,
    ArrowsDownUpIcon, RowsIcon, BoundingBoxIcon, FrameCornersIcon,
    DotsNineIcon, CopySimpleIcon, ArrowsSplitIcon, FunnelSimpleIcon, TableIcon,
    StackIcon, RadicalIcon, ArrowFatLinesRightIcon, WaveSineIcon,
    PlusIcon, MinusIcon, XIcon, DivideIcon, CaretUpIcon,
  } from 'phosphor-svelte';

  let { cat, op, size = 16 }: { cat: OpCategory; op?: string; size?: number } = $props();
</script>

{#if op === 'Reshape' || op === 'RESHAPE'}
  <BoundingBoxIcon {size} />
{:else if op === 'Expand'}
  <ArrowsOutSimpleIcon {size} />
{:else if op === 'Unsqueeze' || op === 'EXPAND_DIMS'}
  <ArrowsOutLineVerticalIcon {size} />
{:else if op === 'Squeeze' || op === 'SQUEEZE'}
  <ArrowsInLineVerticalIcon {size} />
{:else if op === 'Slice' || op === 'SLICE' || op === 'STRIDED_SLICE'}
  <StackIcon {size} />
{:else if op === 'Transpose' || op === 'TRANSPOSE'}
  <ArrowsDownUpIcon {size} />
{:else if op === 'Flatten'}
  <RowsIcon {size} />
{:else if op === 'Pad' || op === 'PAD' || op === 'PADV2' || op === 'MIRROR_PAD'}
  <FrameCornersIcon {size} />
{:else if op === 'Permute'}
  <ArrowsDownUpIcon {size} />
{:else if op === 'ZeroPadding1D' || op === 'ZeroPadding2D' || op === 'ZeroPadding3D'}
  <FrameCornersIcon {size} />
{:else if op === 'Cropping1D' || op === 'Cropping2D' || op === 'Cropping3D'}
  <ScissorsIcon {size} />
{:else if op === 'RepeatVector'}
  <CopySimpleIcon {size} />
{:else if op === 'UpSampling1D' || op === 'UpSampling2D' || op === 'UpSampling3D'}
  <ArrowsOutSimpleIcon {size} />
{:else if op === 'ScatterElements' || op === 'ScatterND' || op === 'SCATTER_ND'}
  <DotsNineIcon {size} />
{:else if op === 'Tile' || op === 'TILE'}
  <CopySimpleIcon {size} />
{:else if op === 'Split' || op === 'SPLIT' || op === 'SPLIT_V'}
  <ArrowsSplitIcon {size} />
{:else if op === 'Gather' || op === 'GatherElements' || op === 'GatherND' || op === 'GATHER' || op === 'GATHER_ND'}
  <FunnelSimpleIcon {size} />
{:else if op === 'Cast' || op === 'CAST' || op === 'BITCAST'}
  <ArrowFatLinesRightIcon {size} />
{:else if op === 'Add' || op === 'ADD'}
  <PlusIcon {size} />
{:else if op === 'Sub' || op === 'SUB'}
  <MinusIcon {size} />
{:else if op === 'Mul' || op === 'MUL'}
  <XIcon {size} />
{:else if op === 'Div' || op === 'DIV'}
  <DivideIcon {size} />
{:else if op === 'Pow' || op === 'POW'}
  <CaretUpIcon {size} />
{:else if op === 'Sqrt' || op === 'SQRT' || op === 'RSQRT'}
  <RadicalIcon {size} />
{:else if op === 'Erf'}
  <WaveSineIcon {size} />
{:else if op === 'Clip'}
  <ScissorsIcon {size} />
{:else if op === 'Not' || op === 'LOGICAL_NOT'}
  <ExclamationMarkIcon {size} />
{:else if op === 'MatMul' || op === 'Gemm' || op === 'BATCH_MATMUL'}
  <TableIcon {size} />
{:else if op === 'Greater' || op === 'GREATER'}
  <span class="glyph">&gt;</span>
{:else if op === 'GreaterOrEqual' || op === 'GREATER_EQUAL'}
  <span class="glyph">≥</span>
{:else if op === 'Less' || op === 'LESS'}
  <span class="glyph">&lt;</span>
{:else if op === 'LessOrEqual' || op === 'LESS_EQUAL'}
  <span class="glyph">≤</span>
{:else if op === 'Equal' || op === 'EQUAL'}
  <span class="glyph">=</span>
{:else if op === 'NOT_EQUAL'}
  <span class="glyph">≠</span>
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
  <SigmaIcon {size} />
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
  <EqualsIcon {size} />
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
