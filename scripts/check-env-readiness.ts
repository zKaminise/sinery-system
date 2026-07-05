/**
 * Env readiness checker (run: `npm run env:check`).
 *
 * Loads the local env files (only when running outside a platform like Vercel,
 * where env vars already live in process.env), resolves the functional
 * environment from APP_ENV, and prints a readiness checklist.
 *
 * SECURITY: this NEVER prints any secret VALUE — only variable NAMES and the
 * boolean/ready flags. Safe to run and paste output anywhere.
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { config as loadEnv } from "dotenv"

import { getEnvReadiness, resolveAppEnv } from "../lib/env/env-readiness"

// Load ONLY the machine's real runtime env (the same files Next.js uses in dev:
// .env.local > .env), so `env:check` reflects THIS environment. dotenv does not
// override already-set vars, so process.env / Vercel-provided vars always win.
// The per-env Vercel colas (.env.staging.local / .env.prd.local) are NOT loaded
// here on purpose — they describe OTHER environments; validate those on the
// deployed target via GET /api/health/deep.
const root = resolve(__dirname, "..")
for (const file of [".env.local", ".env"]) {
  const path = resolve(root, file)
  if (existsSync(path)) loadEnv({ path, override: false })
}

function line(label: string, value: string) {
  console.log(`  ${label.padEnd(22)} ${value}`)
}

function main() {
  const appEnv = resolveAppEnv()
  const r = getEnvReadiness()

  console.log("")
  console.log("Sinery — verificação de ambiente (env readiness)")
  console.log("=".repeat(52))
  line("APP_ENV (resolvido):", appEnv)
  line("NODE_ENV:", process.env.NODE_ENV ?? "(unset)")
  line("Pronto p/ HML:", r.readyForStaging ? "SIM ✅" : "NÃO ❌")
  line("Pronto p/ PRD:", r.readyForProduction ? "SIM ✅" : "NÃO ❌")

  console.log("")
  if (r.missingRequired.length > 0) {
    console.log("Variáveis obrigatórias faltando (por NOME, sem valores):")
    for (const name of r.missingRequired) console.log(`  ✗ ${name}`)
  } else {
    console.log("Nenhuma variável obrigatória faltando. ✅")
  }

  if (r.criticalIssues.length > 0) {
    console.log("")
    console.log("Problemas que BLOQUEIAM produção:")
    for (const issue of r.criticalIssues) console.log(`  ⛔ ${issue}`)
  }

  if (r.warnings.length > 0) {
    console.log("")
    console.log("Avisos (não bloqueiam):")
    for (const w of r.warnings) console.log(`  ⚠ ${w}`)
  }

  console.log("")

  // Exit code reflects readiness for the RESOLVED environment. Local is always
  // informational (exit 0); staging/production fail the process when not ready,
  // so this can gate a CI/pre-deploy step.
  const ok =
    appEnv === "local" ||
    (appEnv === "staging" && r.readyForStaging) ||
    (appEnv === "production" && r.readyForProduction)

  if (!ok) {
    console.log(`Ambiente "${appEnv}" NÃO está pronto. Corrija os itens acima.`)
    process.exit(1)
  }
  console.log(`Ambiente "${appEnv}" OK.`)
}

main()
