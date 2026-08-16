import { defineConfig } from 'tsup';

// Pass 2: entry point - statically re-exports parsers, runs after parsers are built
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  tsconfig: '../../tsconfig.build.json',
  clean: false,
  external: [
    '@wetron/common',
    '@wetron/onnx',
    '@wetron/tflite',
    '@wetron/keras',
    '@wetron/executorch',
    '@wetron/torchscript',
    '@wetron/savedmodel',
    'dagre',
  ],
});
