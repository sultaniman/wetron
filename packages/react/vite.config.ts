import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      tsconfigPath: '../../tsconfig.build.json',
      entryRoot: 'src',
      bundleTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // Predicate rather than a list: every peer and every @wetron/* subpath must
      // stay external, and a hardcoded array silently bundles new deep imports.
      external: (id: string) =>
        /^(?:react$|react\/|react-dom$|@xyflow\/|@phosphor-icons\/|@base-ui\/|@tanstack\/|@wetron\/)/.test(id),
    },
    sourcemap: true,
    cssCodeSplit: false,
  },
});
