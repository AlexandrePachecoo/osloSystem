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

## Fase 6 — implementada

- **WhatsApp real via Meta Cloud API**: o provider mock foi complementado por um
  provider oficial (`src/lib/whatsapp/meta-provider.ts`). A escolha é por env
  `WHATSAPP_PROVIDER` (`mock` default | `meta`); sem as credenciais o canal cai
  no mock e o app continua bootando normal. **Nada muda no fluxo**: a IA já
  classifica/rascunha e o envio continua saindo APENAS pela ação manual
  "Marcar como enviada".
- **Webhook de ingestão** (`POST /api/whatsapp/webhook`): recebe as mensagens da
  Meta, valida a assinatura `X-Hub-Signature-256` (HMAC-SHA256 com
  `WHATSAPP_APP_SECRET`), normaliza cada DM de texto e reusa o mesmo pipeline do
  mock/`ingest` (com dedupe por `externalId`). O `GET` responde ao handshake de
  verificação (`hub.challenge`) usando `WHATSAPP_VERIFY_TOKEN`.
- **Telefone do remetente** (`MensagemWhatsApp.remetente`): guardado na ingestão
  para permitir a resposta 1:1 pela Cloud API. Sem ele (mensagens antigas/mock)
  a ação de envio avisa em vez de tentar enviar.
- **Configuração no painel da Meta**: crie o app em *Meta for Developers* com o
  produto WhatsApp, pegue o *Phone Number ID* e um *access token permanente*
  (System User), defina a URL do webhook como
  `https://<seu-dominio>/api/whatsapp/webhook`, use o mesmo `WHATSAPP_VERIFY_TOKEN`
  e **subscreva ao campo `messages`**. Preencha as envs da seção WhatsApp do
  `.env.example`.
- **Limitações conhecidas**: a Cloud API **não suporta grupos** — o grupo de
  avisos (só adm/portaria) continua manual, fora do fluxo do agente. Texto livre
  só é permitido dentro da **janela de 24h** após a última mensagem do morador
  (respostas a DMs recebidas caem sempre nessa janela). Só mensagens de **texto**
  são ingeridas por ora (mídia/status são ignorados).

## WhatsApp Coexistence — implementado

Conecta o número à Cloud API **sem tirá-lo do celular**: o mesmo número segue no
app **WhatsApp Business** (grupos, chamadas, status e conversas normais
continuam lá) e as DMs 1:1 passam a chegar também na fila do sistema. Nome
oficial na Meta: *Onboarding WhatsApp Business app users*.

- **Página `/whatsapp/conectar`**: abre o Embedded Signup da Meta em modo
  Coexistence (`featureType: whatsapp_business_app_onboarding`). O dono escaneia
  um **QR code com o app WhatsApp Business**; ao final o `code` é trocado por um
  token de negócio no servidor (`POST /api/whatsapp/onboarding`, admin-only) e o
  app é assinado nos webhooks da WABA (`subscribed_apps`). O token e o
  *Phone Number ID* são exibidos para colocar nas envs — nada é persistido.
- **Respostas dadas pelo celular** (webhook `smb_message_echoes`): quando o
  admin responde um morador direto pelo app, o eco chega ao webhook e as
  mensagens ainda abertas daquele contato ganham o carimbo
  `respondidaViaAppEm` — a fila mostra o badge **"Respondida pelo celular"**.
  Fiel ao princípio do sistema, o status do rascunho **não muda sozinho**: o
  admin descarta manualmente se o assunto foi resolvido.
- **Setup no painel da Meta** (uma vez):
  1. App em *Meta for Developers* com os produtos **WhatsApp** e **Facebook
     Login for Business**; empresa com **verificação de negócio** concluída.
  2. Em *Facebook Login for Business > Configurations*, crie uma configuração
     com o WhatsApp habilitado e copie o **Configuration ID** →
     `NEXT_PUBLIC_WHATSAPP_ES_CONFIG_ID` (App ID → `NEXT_PUBLIC_META_APP_ID`).
  3. Webhook: mesma URL `https://<seu-dominio>/api/whatsapp/webhook`, subscreva
     aos campos **`messages`** e **`smb_message_echoes`**.
  4. No celular: o número deve estar no app **WhatsApp Business** atualizado
     (≥ 2.24.17). Conta muito nova pode não ser elegível ainda (critério da
     Meta: tempo de conta e qualidade).
  5. Acesse `/whatsapp/conectar`, conclua o fluxo e copie
     `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_PROVIDER=meta`
     para o ambiente; redeploy.
- **Limitações do Coexistence**: **grupos não sincronizam** com a API (seguem
  funcionando normalmente, mas só no app); chamadas de voz/vídeo só no app; a
  janela de 24h para texto livre continua valendo nos envios pela API.

## Fase 8 — implementada

- **Dois papéis de login**: `ADMIN_PASSWORD` → admin (acesso a tudo) e
  `FUNCIONARIO_PASSWORD` (opcional) → funcionário, que só acessa a aba
  **Portaria** (`/portaria`) — o proxy redireciona qualquer outra rota e todas
  as Server Actions administrativas revalidam o papel internamente
  (`src/lib/session-server.ts`). O cookie de sessão agora carrega o papel
  (`<papel>.<hmac>` — sessões antigas são invalidadas, basta logar de novo).
- **Relatório da portaria** (`/portaria`): campo de nome do colaborador
  (sugestão vem dos funcionários ativos), registro de **ocorrências** com botão
  "Melhorar texto com IA" (OpenAI; sem key, o texto original segue valendo) e
  registro de **encomendas** (apto, descrição, retirada interna/externa — se
  externa, o nome de quem vai retirar) com botão **"Entrega feita"** para dar
  baixa.
- **Carry-over de encomendas**: encomendas sem baixa ficam com
  `relatorioId = null` e reaparecem em todos os relatórios seguintes até serem
  entregues; só ocorrências e entregas baixadas são "fechadas" no envio.
- **Enviar para a administração**: fecha o relatório aberto em um
  `RelatorioPortaria` (snapshot JSON + resumo em texto). O admin vê a lista em
  `/relatorios` (seção "Relatórios da portaria") e o detalhe em
  `/relatorios/portaria/[id]`.
- **PDF** (`GET /api/portaria/relatorio/pdf[?id=...]`): baixa o relatório atual
  ou um já enviado, gerado com `pdf-lib` (JS puro, funciona em serverless).

## Rodando local

1. Dependências: `npm install` (o `postinstall` gera o Prisma Client).
2. Copie `.env.example` para `.env` e preencha. Para banco local:
   ```
   DATABASE_URL="postgresql://postgres@localhost:5432/oslo"
   DIRECT_URL="postgresql://postgres@localhost:5432/oslo"
   ```
   Gere segredos: `openssl rand -hex 32` para `CRON_SECRET` e `AUTH_SECRET`; defina `ADMIN_PASSWORD`
   (mín. 8 chars) e, se quiser o login da portaria, `FUNCIONARIO_PASSWORD` (mín. 8 chars).
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
2. **Aplique as migrations ao Supabase antes/depois de mexer no schema:**
   `npx prisma migrate deploy` (usa `DIRECT_URL` do seu `.env`). As migrations **não**
   rodam no build da Vercel — a conexão direta do Supabase costuma não ser acessível
   de dentro do build —, então este passo é manual e precisa ser repetido sempre que
   houver migrations novas. (Alternativa sem Prisma: rodar o SQL das migrations no
   *SQL Editor* do Supabase.)
3. Na Vercel, configure as envs do `.env.example` (exceto as da Fase 4, por enquanto).
   Com `CRON_SECRET` definida, o Vercel Cron envia `Authorization: Bearer $CRON_SECRET` automaticamente.
4. Os crons estão declarados em `vercel.json` (lembretes: `0 11 * * *` UTC = 08h BRT).
5. Deploy. O `postinstall` roda `prisma generate` no build.

## Próximos passos

- Templates aprovados para responder fora da janela de 24h; suporte a mídia
  (imagem/áudio/documento) no webhook.
- Alternativa para o grupo de avisos (não coberto pela Cloud API).
- Envio externo de lembretes e do relatório semanal (e-mail/WhatsApp).
- Testes automatizados (as funções de `src/domain/` são puras e prontas para unit test).
