/**
 * Clinic slug / subdomain generation + validation (pure — unit-testable).
 * A slug becomes part of a subdomain, so it must be DNS-safe and must never
 * collide with a reserved platform hostname.
 */

/** Hostnames/paths that must never be used as a clinic slug. */
export const RESERVED_SLUGS = new Set([
  "app",
  "www",
  "admin",
  "founder",
  "api",
  "status",
  "suporte",
  "support",
  "sinery",
  "sinere",
  "mail",
  "static",
  "assets",
  "cdn",
])

export const SLUG_MIN_LENGTH = 3
export const SLUG_MAX_LENGTH = 40

/** Normalizes free text into a candidate slug (accents removed, lowercase, hyphenated). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (acentos)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .replace(/-{2,}/g, "-") // collapse repeats
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "")
}

export interface SlugValidation {
  ok: boolean
  error?: string
}

/** Validates an already-normalized slug (does NOT normalize — call slugify first if needed). */
export function validateSlug(slug: string): SlugValidation {
  if (!slug) return { ok: false, error: "Informe um slug/subdomínio." }
  if (slug.length < SLUG_MIN_LENGTH) {
    return { ok: false, error: `O slug precisa ter ao menos ${SLUG_MIN_LENGTH} caracteres.` }
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    return { ok: false, error: `O slug pode ter no máximo ${SLUG_MAX_LENGTH} caracteres.` }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      error: "Use apenas letras minúsculas, números e hífens (sem espaços, acentos ou hífen no início/fim).",
    }
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: `"${slug}" é um slug reservado da plataforma.` }
  }
  return { ok: true }
}

/** True if the slug can be used as a tenant subdomain (valid + not reserved). */
export function isUsableClinicSlug(slug: string): boolean {
  return validateSlug(slug).ok
}
