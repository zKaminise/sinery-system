# HML — Plano de testes manuais (Prompt 25)

Roteiro para validar em `https://hml.app.sinery.com.br` (APP_ENV=staging).

## A. Founder — criar clínica + e-mail automático

1. Acesse `/founder` → **Criar cliente/clínica**.
2. Preencha e crie. Na tela de sucesso, verifique:
   - a **URL de acesso** está no formato **`https://<slug>.hml.app.sinery.com.br`** (não `app.sinery.com.br`);
   - a mensagem indica **✅ e-mail enviado** (Resend real em HML) — não aparece mais "será implementado futuramente";
   - a **senha provisória** aparece (uma única vez).
3. Verifique a caixa de entrada do e-mail do responsável: deve chegar o e-mail de boas-vindas com a **URL correta**, e-mail de login e senha provisória.
4. Acesse a URL de acesso, faça **login** com o e-mail + senha provisória.
5. O sistema força a **troca de senha** no primeiro acesso.
6. No detalhe da clínica no Founder, clique **"Reenviar acesso"** → chega um e-mail com **NOVA** senha provisória (a antiga deixa de valer).

> Observação sobre subdomínio: o **wildcard** `*.hml.app.sinery.com.br` **já está validado/funcional na Vercel**, então `https://<slug>.hml.app.sinery.com.br` resolve normalmente. Com `TENANT_SUBDOMAIN_ENFORCED=true` (recomendado em HML), o login de clínica acontece **no subdomínio** — a raiz `hml.app.sinery.com.br` fica reservada para Founder/site e mostra a tela "acesse pelo endereço da sua clínica". Ver [domains-and-dns.md](./domains-and-dns.md).

## B. Sinery Assist (IA)

Na clínica nova, a Assist já nasce **habilitada** (agendar/remarcar/cancelar) com uma base de conhecimento genérica. Teste (no simulador `/assist` ou via conversa):

1. "Quero marcar uma limpeza amanhã" → deve entender serviço + data e oferecer horários (ou pedir o que faltar).
2. "Pro dia 07/06 quais horários você tem?" → deve **manter o serviço** (limpeza) e buscar horários na nova data; se **07/06 já passou**, deve pedir confirmação ("já passou, quis dizer 07/07?").
3. "Quais serviços vocês realizam?" → deve **listar os serviços ativos** (não transferir).
4. "Quero agendar dia 07/06" → deve **perguntar o serviço** (não transferir cedo).
5. "Quero falar com atendente" → transfere para humano.
6. "Estou com dor forte" → acolhe, não diagnostica e **transfere** (sensível/urgência).
7. Confirme que **só transfere quando necessário** (sensível, urgência, pedido de humano, preço não autorizado, baixa confiança real).

> Em HML a IA roda com **OpenAI real** (`ASSIST_USE_REAL_AI=true`). Se `false`, roda o modo rule-based (determinístico). Ambos listam serviços e evitam transferência prematura.

## C. Paciente novo (preparação WhatsApp/Evolution)

1. Simule um paciente **não cadastrado** pedindo agendamento.
2. A IA deve **pedir o nome completo** (e o e-mail, opcional).
3. Ao confirmar, o sistema associa/cria o paciente a partir do telefone (via WhatsApp/Evolution real).
4. Prossegue para serviço/data/horário.
5. Não deve duplicar paciente se o telefone já existir.

> O disparo/recebimento real depende da **Evolution API** conectada (ainda desligada). Ver [evolution-api-hml.md](./evolution-api-hml.md).

## D. Segurança / regressão

- `/api/health/deep`: readiness ok, **sem** segredos (nenhum token/DSN/URL com token).
- Login, agenda, conversas, checkout e recuperação de senha continuam funcionando.
- `EVOLUTION_API_KEY` e `EVOLUTION_WEBHOOK_SECRET` não aparecem em nenhuma tela.

## E. Multi-tenant por subdomínio (Prompt 27)

> O wildcard `*.hml.app.sinery.com.br` **já está validado/funcional na Vercel** e o
> projeto HML deve estar com `TENANT_SUBDOMAIN_ENFORCED=true` — então **todos** os
> itens abaixo (E1–E6) valem. Se a flag estiver `false`, E1/E5 (bloqueio na raiz)
> ficam inativos; E2/E3/E4/E6 valem em qualquer caso.

**Setup:** duas clínicas de teste, `clinica-a` e `clinica-b`, cada uma com um
usuário próprio.

1. **E1 — raiz não loga clínica (enforced):** com a flag `true`, abra
   `https://hml.app.sinery.com.br/login` → deve aparecer a tela **"Acesse pelo
   endereço da sua clínica"** (com exemplo `https://sua-clinica.hml.app.sinery.com.br`),
   **sem** formulário de login.
2. **E2 — login escopado ok:** em `https://clinica-a.hml.app.sinery.com.br/login`,
   logue com o usuário da **clínica A** → entra normalmente.
3. **E3 — login cross-tenant negado:** em `https://clinica-b.hml.app.sinery.com.br/login`,
   tente logar com o usuário da **clínica A** (senha correta) → **negado** com erro
   genérico ("E-mail ou senha inválidos, ou endereço da clínica incorreto"). Não
   revela se o usuário existe.
4. **E4 — vínculo sessão↔host:** logado na clínica A, troque a URL para
   `https://clinica-b.hml.app.sinery.com.br/dashboard` → **logout/negação** e volta
   ao login. Confira em `/auditoria` (como admin) o evento `TENANT_SESSION_MISMATCH`.
5. **E5 — Founder só na raiz:** `https://clinica-a.hml.app.sinery.com.br/founder` →
   redireciona para a raiz `.../founder/login`. Na raiz, `/founder` funciona normal.
6. **E6 — sem clínica padrão na raiz:** deslogado, a raiz **não** carrega nenhuma
   clínica “default” (nada de `sorria-odonto`); apenas login/site/Founder.

## F. Evolution API — modo mock (sem número)

> `EVOLUTION_SEND_MOCK_MODE=true`. Serve para exercitar UI/Assist sem número real.

1. Use o `curl`/`.http` do kit ([`infra/evolution-hml/tests/`](../infra/evolution-hml/tests/requests.http))
   item **#7** para postar um inbound simulado em
   `/api/webhooks/evolution?token=<secret>`.
2. Confira que uma **conversa** aparece em `/conversas` (canal Evolution/WhatsApp).
3. Com `EVOLUTION_AUTO_PROCESS_ASSIST=true`, a Assist processa e a resposta é
   registrada; o envio é **mockado** (id `mock_evolution_…`) — nada sai de verdade.
4. Token errado no `?token=` → **rejeitado** (auditoria `EVOLUTION_WEBHOOK_INVALID_SECRET`).

## G. Evolution API — modo real (número conectado)

> `EVOLUTION_SEND_MOCK_MODE=false`, instância `sinery-hml` conectada por QR (ver
> [`infra/evolution-hml/README.md`](../infra/evolution-hml/README.md)).

1. **Receber:** envie um WhatsApp para o número de teste (`34991429784` →
   `5534991429784`) → surge a conversa em `/conversas`.
2. **Assist responde:** "quero marcar limpeza amanhã" → a Assist responde **no
   WhatsApp** (via Evolution) e a agenda reflete o horário escolhido.
3. **Humano assume:** responda como humano no inbox → conversa vira HUMAN_HANDLING,
   a Assist cala; **devolver para a Assist** volta a responder.
4. **Enviar:** uma resposta do inbox chega no WhatsApp do número de teste.
5. **Status de entrega:** confira a atualização de status (MESSAGES_UPDATE) na bolha.
6. **Regressão:** desconectar/reconectar a instância não quebra o Sinery (webhook
   volta a entregar após reconexão).
