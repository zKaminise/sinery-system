import { describe, it, expect } from "vitest"

import { maskWhatsAppSecret, maskWhatsAppId } from "@/lib/whatsapp/whatsapp-mask"
import { canManageWhatsAppIntegration, canViewWhatsAppIntegration } from "@/lib/permissions"

describe("maskWhatsAppSecret", () => {
  it("empty → Não configurado", () => {
    expect(maskWhatsAppSecret("")).toBe("Não configurado")
    expect(maskWhatsAppSecret(null)).toBe("Não configurado")
    expect(maskWhatsAppSecret("   ")).toBe("Não configurado")
  })
  it("present → Configurado (never the value)", () => {
    expect(maskWhatsAppSecret("super-secret-token")).toBe("Configurado")
    expect(maskWhatsAppSecret("short")).toBe("Configurado")
  })
})

describe("maskWhatsAppId", () => {
  it("empty → Não configurado", () => {
    expect(maskWhatsAppId("")).toBe("Não configurado")
  })
  it("short → fully masked", () => {
    expect(maskWhatsAppId("123")).toBe("••••")
  })
  it("long → partial reveal of last 4", () => {
    expect(maskWhatsAppId("123456789")).toBe("••••••6789")
  })
})

describe("whatsapp permissions", () => {
  it("OWNER/ADMIN can manage", () => {
    expect(canManageWhatsAppIntegration("OWNER")).toBe(true)
    expect(canManageWhatsAppIntegration("ADMIN")).toBe(true)
  })
  it("RECEPTIONIST/PROFESSIONAL cannot manage", () => {
    expect(canManageWhatsAppIntegration("RECEPTIONIST")).toBe(false)
    expect(canManageWhatsAppIntegration("PROFESSIONAL")).toBe(false)
  })
  it("everyone but PROFESSIONAL can view", () => {
    expect(canViewWhatsAppIntegration("OWNER")).toBe(true)
    expect(canViewWhatsAppIntegration("ADMIN")).toBe(true)
    expect(canViewWhatsAppIntegration("RECEPTIONIST")).toBe(true)
    expect(canViewWhatsAppIntegration("PROFESSIONAL")).toBe(false)
  })
})
