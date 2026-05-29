import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["packages/*/test/**/*.test.ts"],
          exclude: [
            "netron-main/**",
            "**/node_modules/**",
            "**/dist/**",
            "packages/react/test/**",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          include: ["packages/react/test/**/*.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "**/dist/**"],
          environment: "happy-dom",
          setupFiles: ["./packages/react/test/setup.ts"],
        },
      },
    ],
  },
});
