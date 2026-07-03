import { describe, it, expect } from "vitest"
import { createHmac } from "node:crypto"

import { verifyWhatsAppSignature, parseSignatureHeader } from "@/lib/whatsapp/whatsapp-signature"

const SECRET = "test-app-secret"
const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] })
const validSig = "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex")

describe("parseSignatureHeader", () => {
  it("parses sha256=<hex>", () => {
    expect(parseSignatureHeader(validSig)).toHaveLength(64)
  })
  it("null for missing/malformed", () => {
    expect(parseSignatureHeader(null)).toBeNull()
    expect(parseSignatureHeader("garbage")).toBeNull()
    expect(parseSignatureHeader("sha1=abc")).toBeNull()
  })
})

describe("verifyWhatsAppSignature", () => {
  it("accepts a valid signature", () => {
    expect(verifyWhatsAppSignature(body, validSig, SECRET)).toBe(true)
  })
  it("rejects an invalid signature", () => {
    expect(verifyWhatsAppSignature(body, "sha256=" + "0".repeat(64), SECRET)).toBe(false)
  })
  it("rejects a tampered body", () => {
    expect(verifyWhatsAppSignature(body + " ", validSig, SECRET)).toBe(false)
  })
  it("rejects a missing header", () => {
    expect(verifyWhatsAppSignature(body, null, SECRET)).toBe(false)
  })
  it("rejects an empty app secret", () => {
    expect(verifyWhatsAppSignature(body, validSig, "")).toBe(false)
  })
})
