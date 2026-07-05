import { NextResponse } from "next/server"

import { login } from "@/lib/auth"
import { loginSchema } from "@/lib/validation/auth"
import { getHostTenantFromRequest, isSubdomainEnforced } from "@/lib/tenant/tenant-context"
import { resolveAppEnv } from "@/lib/env/env-readiness"
import {
  evaluateRootLoginAccess,
  loginErrorFor,
  ROOT_LOGIN_REQUIRES_SUBDOMAIN_MESSAGE,
} from "@/lib/tenant/tenant-security"
import { createAuditLog } from "@/lib/audit"
import { AuditAction } from "@/lib/audit-actions"

const GENERIC_ERROR = "E-mail ou senha inválidos."

export async function POST(request: Request) {
  // Resolve the tenant from the request host FIRST — it decides both whether
  // login is even allowed here (root-block) and which clinic the lookup is
  // scoped to (subdomain login).
  const hostTenant = getHostTenantFromRequest(request)

  // Root-login block (staging/production, only when TENANT_SUBDOMAIN_ENFORCED):
  // clinic users must authenticate on their clinic subdomain, not the root.
  const rootBlock = evaluateRootLoginAccess({
    appEnv: resolveAppEnv(),
    hostKind: hostTenant.kind,
    enforced: isSubdomainEnforced(),
  })
  if (rootBlock.blocked) {
    await createAuditLog({
      clinicId: null,
      userId: null,
      action: AuditAction.TENANT_LOGIN_BLOCKED_AT_ROOT,
      entity: "User",
      entityId: null,
      description: "Login de clínica bloqueado no domínio raiz (use o subdomínio da clínica).",
      metadata: { hostKind: hostTenant.kind },
    })
    return NextResponse.json({ error: ROOT_LOGIN_REQUIRES_SUBDOMAIN_MESSAGE }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: loginErrorFor(hostTenant) }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: loginErrorFor(hostTenant) }, { status: 400 })
  }

  try {
    const result = await login(parsed.data.email, parsed.data.password, hostTenant)

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? GENERIC_ERROR }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[POST /api/auth/login] unexpected error:", error)
    return NextResponse.json(
      { error: "Não foi possível efetuar o login agora. Tente novamente." },
      { status: 500 }
    )
  }
}
