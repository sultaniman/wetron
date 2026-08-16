import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        ssr: { resolve: { conditions: ['source'] } },
        test: {
          name: 'node',
          include: ['packages/*/test/**/*.test.ts'],
          exclude: [
            'netron-main/**',
            '**/node_modules/**',
            '**/dist/**',
            'packages/react/test/**',
            'packages/svelte/test/**',
          ],
        },
      },
      {
        extends: true,
        plugins: [svelte()],
        resolve: { conditions: ['browser'] },
        ssr: { noExternal: ['@xyflow/svelte'] },
        test: {
          name: 'svelte',
          include: ['packages/svelte/test/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          environment: 'happy-dom',
        },
      },
      {
        extends: true,
        test: {
          name: 'react',
          include: ['packages/react/test/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          environment: 'happy-dom',
          setupFiles: ['./packages/react/test/setup.ts'],
        },
      },
    ],
  },
});
