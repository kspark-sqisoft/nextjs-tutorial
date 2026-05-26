import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // DB 접근 테스트는 직렬 실행이 안전.
    fileParallelism: false,
    testTimeout: 15_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
