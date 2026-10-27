import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "happy-dom",
    // Rendering loads the WebAssembly renderer, which takes a moment the first time
    testTimeout: 20000,
    typecheck: { enabled: true, tsconfig: "./tsconfig.test.json" },
  },
});
