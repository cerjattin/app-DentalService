import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    globals: false,

    setupFiles: ["./tests/setup-env.ts"],

    include: ["tests/**/*.test.ts"],

    restoreMocks: true,

    clearMocks: true,

    mockReset: true,

    /*
     * Estamos ejecutando integration tests
     * contra la misma instancia MySQL.
     *
     * Evitamos inicialmente que distintos
     * archivos manipulen simultáneamente
     * fixtures compartidas.
     */
    fileParallelism: false,
  },
});
