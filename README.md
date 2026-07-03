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

## Próximas fases

- **Fase 3** — CRUD de Estoque, Funcionários e Empresas (o relatório já inclui estoque abaixo do mínimo; falta a tela de cadastro).
- **Fase 4** — assistente de WhatsApp (interface `WhatsAppProvider` + mock, classificação/rascunhos via OpenAI, aprovação manual).

O schema do banco já cobre todas as entidades das fases futuras.
