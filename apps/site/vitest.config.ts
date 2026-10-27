import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "playground/**/*.test.ts",
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
    ],
  },
});
