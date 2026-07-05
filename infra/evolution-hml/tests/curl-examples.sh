#!/usr/bin/env bash
# =============================================================================
# Evolution API — Sinery HML — curl examples (Prompt 27, Part 9)
#
# Mirrors tests/requests.http. Fill the placeholders via environment variables
# (do NOT paste real secrets into this file). Example:
#
#   export EVOLUTION_API_URL="https://evolution-hml.sinery.com.br"
#   export EVOLUTION_API_KEY="..."          # AUTHENTICATION_API_KEY
#   export EVOLUTION_INSTANCE_NAME="sinery-hml"
#   export EVOLUTION_WEBHOOK_SECRET="..."   # also set in Sinery Vercel HML
#   export SINERY_HML_URL="https://hml.app.sinery.com.br"
#   ./curl-examples.sh health
#
# ⚠️  Request bodies vary by Evolution version — confirm against your pinned tag.
# =============================================================================
set -euo pipefail

: "${EVOLUTION_API_URL:?set EVOLUTION_API_URL}"
: "${EVOLUTION_API_KEY:?set EVOLUTION_API_KEY}"
: "${EVOLUTION_INSTANCE_NAME:?set EVOLUTION_INSTANCE_NAME}"
: "${EVOLUTION_WEBHOOK_SECRET:?set EVOLUTION_WEBHOOK_SECRET}"
: "${SINERY_HML_URL:?set SINERY_HML_URL}"

# Test destination (HML). Keep in docs/scripts only — never in application code.
TEST_NUMBER="${TEST_NUMBER:-5534991429784}"

cmd="${1:-help}"

case "$cmd" in
  health)
    curl -sS "${EVOLUTION_API_URL}/" -H "Accept: application/json"
    ;;

  create-instance)
    curl -sS -X POST "${EVOLUTION_API_URL}/instance/create" \
      -H "Content-Type: application/json" \
      -H "apikey: ${EVOLUTION_API_KEY}" \
      -d "{\"instanceName\":\"${EVOLUTION_INSTANCE_NAME}\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}"
    ;;

  connect)
    curl -sS "${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE_NAME}" \
      -H "apikey: ${EVOLUTION_API_KEY}"
    ;;

  state)
    curl -sS "${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}" \
      -H "apikey: ${EVOLUTION_API_KEY}"
    ;;

  set-webhook)
    curl -sS -X POST "${EVOLUTION_API_URL}/webhook/set/${EVOLUTION_INSTANCE_NAME}" \
      -H "Content-Type: application/json" \
      -H "apikey: ${EVOLUTION_API_KEY}" \
      -d "{\"webhook\":{\"enabled\":true,\"url\":\"${SINERY_HML_URL}/api/webhooks/evolution?token=${EVOLUTION_WEBHOOK_SECRET}\",\"webhookByEvents\":false,\"webhookBase64\":false,\"events\":[\"MESSAGES_UPSERT\",\"MESSAGES_UPDATE\"]}}"
    ;;

  send-text)
    curl -sS -X POST "${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}" \
      -H "Content-Type: application/json" \
      -H "apikey: ${EVOLUTION_API_KEY}" \
      -d "{\"number\":\"${TEST_NUMBER}\",\"text\":\"Sinery HML — mensagem de teste via Evolution API.\"}"
    ;;

  test-sinery-webhook)
    # Simulate an inbound MESSAGES_UPSERT straight to Sinery (no phone needed).
    curl -sS -X POST "${SINERY_HML_URL}/api/webhooks/evolution?token=${EVOLUTION_WEBHOOK_SECRET}" \
      -H "Content-Type: application/json" \
      -d "{\"event\":\"messages.upsert\",\"instance\":\"${EVOLUTION_INSTANCE_NAME}\",\"data\":{\"key\":{\"remoteJid\":\"${TEST_NUMBER}@s.whatsapp.net\",\"fromMe\":false,\"id\":\"TEST-MESSAGE-0001\"},\"pushName\":\"Paciente Teste\",\"message\":{\"conversation\":\"Olá, gostaria de agendar uma limpeza\"},\"messageTimestamp\":1751000000}}"
    ;;

  help|*)
    cat <<'USAGE'
Usage: ./curl-examples.sh <command>

Commands:
  health               GET /                      — API is up (version info)
  create-instance      POST /instance/create      — create the sinery-hml instance
  connect              GET /instance/connect/...   — fetch QR to scan
  state                GET /instance/connectionState/... — open|connecting|close
  set-webhook          POST /webhook/set/...       — point webhook at Sinery HML
  send-text            POST /message/sendText/...  — send a test message
  test-sinery-webhook  POST Sinery /api/webhooks/evolution with a fake inbound
USAGE
    ;;
esac
