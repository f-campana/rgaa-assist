import { defineConfig } from "vitest/config";

/** Post-build privacy suite (design 4.2, 4.3). Fails on code without the guard, by design: `pnpm test:privacy`. */
export default defineConfig({
  test: {
    include: ["tests/privacy/**/*.privacy.ts"],
    fileParallelism: false,
    testTimeout: 180_000,
  },
});
