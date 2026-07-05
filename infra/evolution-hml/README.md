# Evolution API — Sinery HML (homologação)

Self-hosted WhatsApp gateway used **only in HML/staging** so the team can test
the full flow **WhatsApp → Evolution API → Sinery → Sinery Assist/OpenAI →
Agenda → Evolution API → WhatsApp** with a real phone number, without waiting on
Meta's official approval.

> **No real secrets live in this folder.** Copy [`.env.example`](.env.example) →
> `.env` on the host and fill it there. `.env` must never be committed.

Related docs: [`docs/evolution-api-hml.md`](../../docs/evolution-api-hml.md),
[`docs/environment-variables.md`](../../docs/environment-variables.md),
[`docs/hml-qa-test-plan.md`](../../docs/hml-qa-test-plan.md).

---

## 1. What this is / why HML only

Evolution API is an open-source, unofficial WhatsApp gateway (Baileys under the
hood). It connects by scanning a QR code from a normal WhatsApp account — great
for **fast testing in HML**, but it is **not** the officially supported path and
carries account-ban risk. We use it to validate Sinery end-to-end before the
Meta integration is approved.

## 2. Why Meta (Cloud API) in production

Production uses the **official Meta WhatsApp Cloud API** — stable, supported,
compliant, with proper templates and no ban risk from unofficial clients. Sinery
already implements a provider abstraction, so production runs on Meta while HML
runs on Evolution. Evolution is **blocked in production** unless explicitly
allowed (`EVOLUTION_ALLOW_IN_PRODUCTION`), and we keep that off.

## 3. Prerequisites

- A host with Docker + Docker Compose (a small VPS is enough for HML).
- A dedicated WhatsApp number for HML testing (not a personal/primary number).
- A subdomain for the gateway, e.g. `evolution-hml.sinery.com.br`, behind HTTPS.

## 4. Configure the environment

```bash
cd infra/evolution-hml
cp .env.example .env
# edit .env — set SERVER_URL, AUTHENTICATION_API_KEY, DB/Redis creds, CORS
```

Generate a strong API key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 5. Run it

```bash
docker compose up -d
docker compose ps            # all services healthy?
docker compose logs -f evolution-api
```

This starts **Evolution API** (port `8080`), **PostgreSQL**, and **Redis** with
persistent volumes. Data survives restarts.

## 6. Hosting options

Any Docker-capable host works. Common choices:

- **Plain VPS** (Hetzner, DigitalOcean, Contabo…) with Docker Compose — cheapest,
  most control. Put Nginx/Caddy/Traefik in front for HTTPS.
- **EasyPanel / Coolify** — self-hosted PaaS with a UI; import this compose or
  the Evolution template, set env vars, done. Handles HTTPS for you.
- **Render / Railway** — managed; run the Evolution image with attached Postgres
  + Redis add-ons. Simplest, but check pricing for an always-on service.

## 7. Point the domain

Create a DNS **A/AAAA** record `evolution-hml.sinery.com.br` → your host's IP
(or a CNAME if your PaaS gives you one). This is **separate** from Sinery's app
domains; it does not touch the `*.hml.app.sinery.com.br` wildcard.

## 8. HTTPS / reverse proxy

Never expose Evolution over plain HTTP. Terminate TLS with Caddy/Nginx/Traefik
(or your PaaS) and proxy to `127.0.0.1:8080`. Set `SERVER_URL` to the public
**https://** URL. Example Caddy one-liner:

```
evolution-hml.sinery.com.br {
    reverse_proxy 127.0.0.1:8080
}
```

## 9. Generate + protect the API key

`AUTHENTICATION_API_KEY` is the global key sent in the `apikey` header on every
request. Treat it like a password: strong, random, only in `.env` and in Vercel
HML (`EVOLUTION_API_KEY`). Rotate it if it leaks.

## 10. Create the instance

Create an instance named **`sinery-hml`** (must match Sinery's
`EVOLUTION_INSTANCE_NAME`). See [`tests/requests.http`](tests/requests.http) #2
or:

```bash
EVOLUTION_API_URL=... EVOLUTION_API_KEY=... EVOLUTION_INSTANCE_NAME=sinery-hml \
  ./tests/curl-examples.sh create-instance
```

## 11. Connect the test number

Use `34991429784` (send/format as `5534991429784`). This number lives in **docs
only** — it is never hardcoded in application code.

## 12. QR code / pairing

Call **connect** (`tests/requests.http` #3) to get a QR code, then in WhatsApp on
the test phone: *Linked devices → Link a device →* scan. Check **state**
(`#4`) — `open` means connected.

## 13. Configure the webhook → Sinery

Point the instance webhook at Sinery HML (`tests/requests.http` #5):

```
https://hml.app.sinery.com.br/api/webhooks/evolution?token=<EVOLUTION_WEBHOOK_SECRET>
```

The `token` **must** equal Sinery's `EVOLUTION_WEBHOOK_SECRET` — Sinery rejects
mismatched tokens (audited as `EVOLUTION_WEBHOOK_INVALID_SECRET`).

## 14. Events

Subscribe to:

- **`MESSAGES_UPSERT`** (`messages.upsert`) — inbound messages. **Required.**
- **`MESSAGES_UPDATE`** (`messages.update`) — delivery/read status. Recommended.

Event-name casing (`MESSAGES_UPSERT` vs `messages.upsert`) varies by version;
Sinery's parser accepts the Evolution shape.

## 15. Test send

Send a text (`tests/requests.http` #6 / `send-text`). You should receive it on
the test phone. A failure here usually means the instance isn't `open` or the
number format is wrong.

## 16. Test receive (end-to-end)

Reply from the phone. Evolution posts `MESSAGES_UPSERT` to Sinery, which creates
a conversation/message and (if enabled) runs Sinery Assist and replies back
through Evolution. You can also simulate an inbound without a phone using
`tests/requests.http` #7 (`test-sinery-webhook`).

## 17. Update Vercel (HML) env vars

Set on the Sinery **HML** project (see `docs/environment-variables.md`):

```
MESSAGING_PROVIDER=evolution
EVOLUTION_API_ENABLED=true
EVOLUTION_API_URL=https://evolution-hml.sinery.com.br
EVOLUTION_API_KEY=<AUTHENTICATION_API_KEY>
EVOLUTION_INSTANCE_NAME=sinery-hml
EVOLUTION_WEBHOOK_SECRET=<random; same token used in the webhook URL>
EVOLUTION_WEBHOOK_PATH=/api/webhooks/evolution
EVOLUTION_SEND_MESSAGES_ENABLED=true
EVOLUTION_SEND_MOCK_MODE=false
```

Keep the Meta `WHATSAPP_*` vars empty/off in HML — the provider is Evolution.

## 18. Disconnect / reconnect, logs

- **Logs:** `docker compose logs -f evolution-api` (raise `LOG_LEVEL` to `INFO`/
  `DEBUG` temporarily when debugging).
- **Reconnect:** if the session drops, call **connect** again and re-scan the QR.
- **Reset an instance:** delete it via the API and recreate, or stop the stack
  and remove the `evolution_instances` volume for a clean slate.

## 19. Risks & good practice

- Unofficial client → **account-ban risk**. Use a disposable HML number.
- Keep it **HML-only**; production stays on Meta.
- Restrict `CORS_ORIGIN`, keep the API behind HTTPS, never expose `8080`
  directly, and keep the API key/DB/Redis creds only in `.env`.
- Pin an explicit image tag; test upgrades before bumping.

---

### Verify env names

Env-var **names** and request-body shapes differ between Evolution API versions.
Before deploying, confirm the values in `docker-compose.yml`, `.env.example`, and
`tests/` against your pinned image tag using the upstream docs/README:
<https://github.com/EvolutionAPI/evolution-api>. Where a name/shape is
version-sensitive it is flagged in-line with a "confirm/verify" note.
