import { defineConfig } from 'tsup';

// Pass 1: library modules - no parser deps, used by other core entry points
export default defineConfig({
  entry: {
    detect: 'src/detect.ts',
    categories: 'src/categories.ts',
    transform: 'src/transform.ts',
    'edge-path': 'src/edge-path.ts',
    'panel-utils': 'src/panel-utils.ts',
    'format-val': 'src/format-val.ts',
    'heatmap-color': 'src/heatmap-color.ts',
    'tensor-index': 'src/tensor-index.ts',
    'tensor-slice': 'src/tensor-slice.ts',
    'weight-decoder': 'src/weight-decoder.ts',
    'weight-stats': 'src/weight-stats.ts',
    'weight-inspection': 'src/weight-inspection.ts',
    'weight-distribution': 'src/weight-distribution.ts',
    'weight-axis-stats': 'src/weight-axis-stats.ts',
    'weight-sparsity': 'src/weight-sparsity.ts',
    'weight-kernel': 'src/weight-kernel.ts',
    'weight-quantization': 'src/weight-quantization.ts',
    'weight-diagnostics': 'src/weight-diagnostics.ts',
    'inspector-hints': 'src/inspector-hints.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  tsconfig: '../../tsconfig.build.json',
  clean: true,
  external: ['@wetron/common', 'dagre'],
});
