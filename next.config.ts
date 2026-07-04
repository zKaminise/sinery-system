import type { NextConfig } from "next";

// Baseline security headers applied to every response. Deliberately conservative
// (no strict CSP yet — that needs per-page nonce work and could break Next's
// inline runtime / Sentry; tracked in docs/v1-release-checklist.md). These are
// safe, framework-agnostic hardening headers that don't change app behavior.
const securityHeaders = [
  // Clickjacking: the app is never meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  // MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which may contain ids) to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Powerful features we don't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// HSTS only in production (never on localhost/HTTP dev).
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// NOTE: Sentry is wired MANUALLY (instrumentation.ts + instrumentation-client.ts
// + lib/observability/sentry-options.ts, DSN-guarded with PII scrubbing) and NOT
// via withSentryConfig — that wrapper is intentionally avoided in this project
// (Turbopack build + no source-map upload by design). See docs/observability.md.
export default nextConfig;
