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

> Observação sobre subdomínio: acessar `https://<slug>.hml.app.sinery.com.br` só resolve se o **wildcard DNS/Vercel** `*.hml.app.sinery.com.br` estiver configurado (ver [domains-and-dns.md](./domains-and-dns.md)). Sem o wildcard, use `https://hml.app.sinery.com.br` (login geral) — o login funciona igual; muda só o host.

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
