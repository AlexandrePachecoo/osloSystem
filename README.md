# Oslo — Administração de Condomínio

Sistema web de administração de condomínio (usuário único/admin). Next.js App Router + TypeScript, Prisma + Supabase (Postgres), Vercel Cron para tarefas agendadas.

## Stack

- **Next.js 16 (App Router) + TypeScript** — Server Actions para mutations do painel; Route Handlers para rotas chamadas de fora (crons)
- **Prisma 7** — client sem engine Rust, com driver adapter `pg`; URLs de conexão em `prisma.config.ts` (migrations) e `src/lib/prisma.ts` (runtime)
- **Supabase Postgres** — runtime via Supavisor em *transaction mode* (porta 6543); migrations via conexão direta (5432)
- **TailwindCSS 4**, **Zod 4**
- **Vercel Cron** — rotas idempotentes protegidas por `CRON_SECRET`

## Estrutura

```
prisma/               schema + migrations versionadas
src/
  app/(painel)/       páginas autenticadas (dashboard, serviços, lembretes)
  app/login/          login do admin
  app/api/cron/       rotas de cron (Bearer CRON_SECRET)
  actions/            Server Actions (Zod → domínio → Prisma)
  domain/             regras puras (máquina de estados de Servico)
  schemas/            schemas Zod de entrada
  lib/                prisma singleton, env validada, sessão, cron-auth
  components/         UI compartilhada
  proxy.ts            proteção de rotas (cookie de sessão HMAC)
```

## Fase 1 — implementada

- CRUD de `Servico` com máquina de estados validada:
  `orcamento → aprovado → em_andamento → feito`; `rejeitado` só a partir de `orcamento`/`aprovado`.
  Toda transição grava `ServicoStatusLog` na mesma transação.
- Listagem com filtro por status + visão em board (colunas por status).
- Cron diário (`/api/cron/lembretes`, 08h BRT): serviços sem mudança de status há mais de
  `LEMBRETE_DIAS_SEM_MUDANCA` dias (default 5) e não terminais geram `Lembrete`.
  Idempotente — índice parcial garante no máximo 1 lembrete ativo por serviço; mudar o status resolve o lembrete.
- Auth simples: senha única (`ADMIN_PASSWORD`) + cookie HMAC (`AUTH_SECRET`).
- Exclusão de serviço permitida apenas em `orcamento`, `feito` ou `rejeitado`.

## Fase 2 — implementada

- **Relatório semanal** (`Relatorio`): serviços por status, prioridades alta/urgente pendentes,
  lembretes ativos, estoque abaixo do mínimo e movimentações de status da semana.
  Gravado no banco (`dados` JSON) + resumo em markdown pronto para envio (botão copiar no painel).
- Cron semanal `/api/cron/relatorio-semanal` (`0 23 * * 0` UTC = domingo 20h BRT).
  O período é a semana corrente em BRT (segunda 00:00 → segunda 00:00), determinístico —
  reexecutar faz upsert do mesmo registro (unique por período), nunca duplica.
- Geração sob demanda: botão "Gerar relatório da semana" em `/relatorios`
  (ou `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/relatorio-semanal`).

## Fase 3 — implementada

- CRUD de **Estoque** (`/estoque`): destaque visual (linha vermelha + badge) para itens com
  `quantidade < quantidadeMinima`, alerta na listagem e no dashboard. Já alimenta o relatório semanal.
- CRUD de **Funcionários** (`/funcionarios`): status ativo/inativo com badge; exclusão sugere
  inativar em vez de apagar.
- CRUD de **Empresas** (`/empresas`): contagem de serviços vinculados; excluir empresa preserva
  os serviços (FK `SetNull`). Empresas aparecem no select do formulário de serviço.

## Fase 4 — implementada

- **Fila de WhatsApp** (`/whatsapp`): mensagem recebida → classificação de prioridade e rascunho
  de resposta via OpenAI → entra como `pendente`. **Nada é enviado automaticamente** — aprovar,
  marcar como enviada e descartar são ações manuais (`pendente → aprovado → enviado`,
  `descartado` a partir de pendente/aprovado). Prioridade e rascunho são editáveis no painel.
- **Ingestão abstraída**: interface `WhatsAppProvider` (`src/lib/whatsapp/provider.ts`) com
  implementação mock que apenas loga. O ponto de troca para o provider real (Meta Cloud API ou
  Baileys) está em `src/lib/whatsapp/index.ts`; o ponto exato do envio real está comentado em
  `src/actions/mensagens.ts` (ação "Marcar como enviada").
- **Alimentação do mock**: formulário "Simular mensagem recebida" no painel e endpoint
  `POST /api/whatsapp/ingest` (Bearer `CRON_SECRET`), com dedupe por `externalId`:
  ```bash
  curl -X POST http://localhost:3000/api/whatsapp/ingest \
    -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
    -d '{"autor":"Maria (302)","texto":"Vazamento na garagem","externalId":"wamid.1"}'
  ```
- **Tolerante a falha da IA**: a mensagem é salva ANTES da chamada à OpenAI; sem
  `OPENAI_API_KEY` (ou com erro/timeout), entra na fila sem classificação e o admin preenche
  manualmente. Modelo configurável via `OPENAI_MODEL` (default `gpt-4o-mini`), saída
  estruturada (JSON Schema), prompt em `src/lib/openai.ts`.

## Fase 5 — implementada

- **Empresa não cadastrada no serviço**: campo livre `empresaNome` no formulário — dá para
  registrar um orçamento com o nome da empresa sem cadastrá-la. Se uma empresa cadastrada
  for selecionada, o nome livre é ignorado.
- **"Avisar novamente após (dias)" por serviço** (`lembreteDias`): sobrepõe o default global
  do cron de lembretes. Resolver um lembrete sem mudar o status adia o próximo aviso pelo
  mesmo prazo (contado do último lembrete).
- **Lembretes manuais** (`/lembretes`): o admin cria lembretes avulsos ou vinculados a um
  serviço (`Lembrete.servicoId` agora é opcional).
- **Estoque rápido no painel**: busca por nome + adicionar/retirar unidades sem sair do
  dashboard. Retirada é condicionada ao saldo no banco (nunca fica negativa).
- **IA com contexto do sistema**: a classificação/rascunho do WhatsApp agora recebe os
  serviços em aberto e as notas de contexto (`NotaContexto`) — se um morador perguntar por
  um problema que já tem serviço em andamento, o rascunho responde com base nisso.
- **Assistente no painel**: chat box em que o admin conversa com a IA que executa ações via
  function calling (`src/lib/assistente.ts`): criar serviço (ex.: relato de vazamento já
  sendo resolvido entra como "em andamento"), criar lembrete, salvar nota de contexto,
  consultar serviços e movimentar estoque. Também há um card "Contexto da IA" para
  alimentar/remover notas diretamente. Sem `OPENAI_API_KEY`, o chat aparece desativado e o
  restante do painel funciona normalmente.

## Rodando local

1. Dependências: `npm install` (o `postinstall` gera o Prisma Client).
2. Copie `.env.example` para `.env` e preencha. Para banco local:
   ```
   DATABASE_URL="postgresql://postgres@localhost:5432/oslo"
   DIRECT_URL="postgresql://postgres@localhost:5432/oslo"
   ```
   Gere segredos: `openssl rand -hex 32` para `CRON_SECRET` e `AUTH_SECRET`; defina `ADMIN_PASSWORD` (mín. 8 chars).
3. Migrations: `npx prisma migrate deploy` (ou `npx prisma migrate dev` para desenvolver schema).
4. `npm run dev` → http://localhost:3000 (login com `ADMIN_PASSWORD`).
5. Testar o cron manualmente:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/lembretes
   ```
   Reexecutar é seguro (não duplica lembretes). Para simular serviço parado, recue `statusChangedAt` no banco.

## Deploy na Vercel

1. Crie o projeto Supabase e copie as connection strings (Settings → Database):
   - `DATABASE_URL` = *Transaction pooler* (porta **6543**)
   - `DIRECT_URL` = conexão direta / *Session* (porta **5432**)
2. Rode as migrations contra o Supabase: `npx prisma migrate deploy` (usa `DIRECT_URL` do seu `.env`).
3. Na Vercel, configure as envs do `.env.example` (exceto as da Fase 4, por enquanto).
   Com `CRON_SECRET` definida, o Vercel Cron envia `Authorization: Bearer $CRON_SECRET` automaticamente.
4. Os crons estão declarados em `vercel.json` (lembretes: `0 11 * * *` UTC = 08h BRT).
5. Deploy. O `postinstall` roda `prisma generate` no build.

## Próximos passos (fora do escopo das 4 fases)

- Plugar o provider real de WhatsApp (Meta Cloud API ou Baileys) implementando
  `WhatsAppProvider` e o webhook de ingestão.
- Envio externo de lembretes e do relatório semanal (e-mail/WhatsApp).
- Testes automatizados (as funções de `src/domain/` são puras e prontas para unit test).
