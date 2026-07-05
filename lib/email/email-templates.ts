/**
 * Transactional email templates (pure). Each builder returns { subject, html,
 * text }. Simple, brand-light layout with an HTML + plain-text fallback.
 */

import { appBaseUrl } from "@/lib/tenant/tenant-url"

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const BRAND = "Sinery System"
const SUPPORT = "kaminise@sinery.com.br"

/**
 * Brand logo lockup for e-mails: the official icon (hosted PNG, since e-mail
 * clients block SVG/data-URIs) + the "Sinery" wordmark. The wordmark text stays
 * even when images are blocked (graceful fallback). The icon is served from the
 * deployed app (`/brand/sinery-icon.png`) via the env base URL.
 */
function brandHeader(): string {
  const logoUrl = `${appBaseUrl()}/brand/sinery-icon.png`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px"><tr>
      <td style="vertical-align:middle"><img src="${logoUrl}" width="36" height="36" alt="Sinery" style="display:block;border:0;outline:none;text-decoration:none;width:36px;height:36px"></td>
      <td style="vertical-align:middle;padding-left:10px"><span style="font-size:22px;font-weight:800;color:#1e293b;letter-spacing:-0.4px;font-family:Arial,Helvetica,sans-serif">Sinery</span></td>
    </tr></table>`
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    ${brandHeader()}
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="font-size:12px;color:#64748b;margin-top:16px">
      ${BRAND} — tecnologia para clínicas. Dúvidas? Responda este e-mail (${SUPPORT}).
    </p>
  </div>
</body></html>`
}

function esc(v: string): string {
  return String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))
}

// --- password reset code ---------------------------------------------------

export function passwordResetCodeEmail(data: { code: string; ttlMinutes: number }): RenderedEmail {
  const subject = "Seu código de recuperação — Sinery"
  const html = layout(
    "Recuperação de senha",
    `<p>Use o código abaixo para redefinir sua senha:</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#0f766e;margin:16px 0">${esc(data.code)}</p>
     <p>O código expira em <strong>${data.ttlMinutes} minutos</strong>. Se você não solicitou, ignore este e-mail.</p>`
  )
  const text = `Recuperação de senha Sinery\n\nCódigo: ${data.code}\nExpira em ${data.ttlMinutes} minutos.\nSe você não solicitou, ignore este e-mail.`
  return { subject, html, text }
}

// --- owner welcome (founder / checkout) ------------------------------------

function ownerWelcome(data: {
  ownerName: string
  clinicName: string
  url: string
  loginEmail: string
  provisionalPassword: string
}, origin: "founder" | "checkout"): RenderedEmail {
  const subject = "Seu acesso ao Sinery System foi criado"
  const intro =
    origin === "checkout"
      ? "Pagamento confirmado! Seu acesso ao Sinery System está pronto."
      : "Seu acesso ao Sinery System foi criado."
  const html = layout(
    "Bem-vindo(a) ao Sinery",
    `<p>Olá, ${esc(data.ownerName)}. ${intro}</p>
     <p><strong>Clínica:</strong> ${esc(data.clinicName)}<br/>
        <strong>Acesse:</strong> <a href="${esc(data.url)}">${esc(data.url)}</a><br/>
        <strong>E-mail de login:</strong> ${esc(data.loginEmail)}<br/>
        <strong>Senha provisória:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${esc(data.provisionalPassword)}</code></p>
     <p>No primeiro acesso, será necessário <strong>trocar a senha</strong>.</p>`
  )
  const text = `${intro}\n\nClínica: ${data.clinicName}\nAcesse: ${data.url}\nLogin: ${data.loginEmail}\nSenha provisória: ${data.provisionalPassword}\n\nNo primeiro acesso, troque a senha.`
  return { subject, html, text }
}

export function ownerWelcomeFounderEmail(data: Parameters<typeof ownerWelcome>[0]): RenderedEmail {
  return ownerWelcome(data, "founder")
}
export function ownerWelcomeCheckoutEmail(data: Parameters<typeof ownerWelcome>[0]): RenderedEmail {
  return ownerWelcome(data, "checkout")
}

// --- temporary password reset (founder re-send access) ---------------------

export function temporaryPasswordResetEmail(data: {
  ownerName: string
  clinicName: string
  url: string
  loginEmail: string
  provisionalPassword: string
}): RenderedEmail {
  const subject = "Nova senha provisória — Sinery System"
  const html = layout(
    "Nova senha de acesso",
    `<p>Olá, ${esc(data.ownerName)}. Uma nova senha provisória foi gerada para o acesso da clínica <strong>${esc(data.clinicName)}</strong>.</p>
     <p><strong>Acesse:</strong> <a href="${esc(data.url)}">${esc(data.url)}</a><br/>
        <strong>E-mail:</strong> ${esc(data.loginEmail)}<br/>
        <strong>Senha provisória:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${esc(data.provisionalPassword)}</code></p>
     <p>Troque a senha no próximo acesso.</p>`
  )
  const text = `Nova senha provisória — ${data.clinicName}\nAcesse: ${data.url}\nLogin: ${data.loginEmail}\nSenha provisória: ${data.provisionalPassword}\nTroque a senha no próximo acesso.`
  return { subject, html, text }
}

// --- billing (confirmed / overdue) + checkout pending (placeholders) -------

export function billingPaymentConfirmedEmail(data: { clinicName: string; amount: string }): RenderedEmail {
  const subject = "Pagamento confirmado — Sinery"
  const html = layout("Pagamento confirmado", `<p>Recebemos o pagamento de <strong>${esc(data.amount)}</strong> da clínica <strong>${esc(data.clinicName)}</strong>. Obrigado!</p>`)
  return { subject, html, text: `Pagamento confirmado (${data.amount}) — ${data.clinicName}. Obrigado!` }
}

export function billingPaymentOverdueEmail(data: { clinicName: string; amount: string; dueDate: string }): RenderedEmail {
  const subject = "Pagamento em atraso — Sinery"
  const html = layout("Pagamento em atraso", `<p>O pagamento de <strong>${esc(data.amount)}</strong> da clínica <strong>${esc(data.clinicName)}</strong> (venc. ${esc(data.dueDate)}) está em atraso. Regularize para manter o acesso.</p>`)
  return { subject, html, text: `Pagamento em atraso (${data.amount}, venc. ${data.dueDate}) — ${data.clinicName}.` }
}

export function checkoutPaymentPendingEmail(data: { clinicName: string; paymentUrl: string }): RenderedEmail {
  const subject = "Finalize seu pagamento — Sinery"
  const html = layout("Quase lá!", `<p>Para ativar o acesso da clínica <strong>${esc(data.clinicName)}</strong>, conclua o pagamento:</p><p><a href="${esc(data.paymentUrl)}">${esc(data.paymentUrl)}</a></p>`)
  return { subject, html, text: `Finalize o pagamento para ativar ${data.clinicName}: ${data.paymentUrl}` }
}
