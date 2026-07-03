import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

/**
 * Vitest config for pure unit tests of the Sinery Assist rule helpers.
 * The `@` alias mirrors tsconfig so tests can import `@/lib/...`. Tests only
 * cover PURE modules (no `server-only`, no Prisma) — see tests/README.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
})
