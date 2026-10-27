import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

const src = (file: string) =>
  fileURLToPath(new URL(`./src/${file}`, import.meta.url));

export default defineConfig({
  // Tests use JSX the way consumers do, compiled against the local runtime
  esbuild: { jsx: "automatic", jsxImportSource: "@zplkit/core" },
  resolve: {
    alias: {
      "@zplkit/core/jsx-runtime": src("jsx-runtime.ts"),
      "@zplkit/core/jsx-dev-runtime": src("jsx-dev-runtime.ts"),
    },
  },
  test: {
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.test.json",
    },
  },
});
