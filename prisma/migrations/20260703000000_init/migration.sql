-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- CreateEnum
CREATE TYPE "ServicoStatus" AS ENUM ('orcamento', 'aprovado', 'em_andamento', 'feito', 'rejeitado');

-- CreateEnum
CREATE TYPE "RascunhoStatus" AS ENUM ('pendente', 'aprovado', 'enviado', 'descartado');

-- CreateEnum
CREATE TYPE "FuncionarioStatus" AS ENUM ('ativo', 'inativo');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "contato" TEXT,
    "categoria" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "contato" TEXT,
    "status" "FuncionarioStatus" NOT NULL DEFAULT 'ativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEstoque" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "quantidadeMinima" INTEGER NOT NULL DEFAULT 0,
    "unidade" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "valorOrcamento" DECIMAL(12,2),
    "prioridade" "Prioridade" NOT NULL DEFAULT 'media',
    "status" "ServicoStatus" NOT NULL DEFAULT 'orcamento',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicoStatusLog" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "deStatus" "ServicoStatus",
    "paraStatus" "ServicoStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicoStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lembrete" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lembrete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relatorio" (
    "id" TEXT NOT NULL,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFim" TIMESTAMP(3) NOT NULL,
    "dados" JSONB NOT NULL,
    "resumo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemWhatsApp" (
    "id" TEXT NOT NULL,
    "textoOriginal" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "externalId" TEXT,
    "prioridade" "Prioridade",
    "rascunhoResposta" TEXT,
    "rascunhoStatus" "RascunhoStatus" NOT NULL DEFAULT 'pendente',
    "recebidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MensagemWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Servico_status_idx" ON "Servico"("status");

-- CreateIndex
CREATE INDEX "Servico_statusChangedAt_idx" ON "Servico"("statusChangedAt");

-- CreateIndex
CREATE INDEX "ServicoStatusLog_servicoId_idx" ON "ServicoStatusLog"("servicoId");

-- CreateIndex
CREATE INDEX "Lembrete_resolvido_idx" ON "Lembrete"("resolvido");

-- CreateIndex
CREATE INDEX "Lembrete_servicoId_idx" ON "Lembrete"("servicoId");

-- CreateIndex
CREATE UNIQUE INDEX "Relatorio_periodoInicio_periodoFim_key" ON "Relatorio"("periodoInicio", "periodoFim");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemWhatsApp_externalId_key" ON "MensagemWhatsApp"("externalId");

-- CreateIndex
CREATE INDEX "MensagemWhatsApp_rascunhoStatus_idx" ON "MensagemWhatsApp"("rascunhoStatus");

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoStatusLog" ADD CONSTRAINT "ServicoStatusLog_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lembrete" ADD CONSTRAINT "Lembrete_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índice parcial: no máximo 1 lembrete NÃO resolvido por serviço (idempotência do cron)
CREATE UNIQUE INDEX "lembrete_um_ativo_por_servico" ON "Lembrete"("servicoId") WHERE "resolvido" = false;
