-- Fase 8 — Portaria: ocorrências + encomendas registradas pelo funcionário e
-- relatórios enviados para a administração. Encomendas não entregues ficam com
-- relatorioId NULL e reaparecem nos relatórios seguintes até a baixa.

-- CreateEnum
CREATE TYPE "EncomendaTipo" AS ENUM ('interna', 'externa');

-- CreateTable
CREATE TABLE "RelatorioPortaria" (
    "id" TEXT NOT NULL,
    "colaborador" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "resumo" TEXT NOT NULL,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioPortaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcorrenciaPortaria" (
    "id" TEXT NOT NULL,
    "colaborador" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "relatorioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcorrenciaPortaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncomendaPortaria" (
    "id" TEXT NOT NULL,
    "apto" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "EncomendaTipo" NOT NULL DEFAULT 'interna',
    "retiradaPor" TEXT,
    "colaborador" TEXT NOT NULL,
    "entregue" BOOLEAN NOT NULL DEFAULT false,
    "entregueEm" TIMESTAMP(3),
    "relatorioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncomendaPortaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcorrenciaPortaria_relatorioId_idx" ON "OcorrenciaPortaria"("relatorioId");

-- CreateIndex
CREATE INDEX "EncomendaPortaria_entregue_idx" ON "EncomendaPortaria"("entregue");

-- CreateIndex
CREATE INDEX "EncomendaPortaria_relatorioId_idx" ON "EncomendaPortaria"("relatorioId");

-- AddForeignKey
ALTER TABLE "OcorrenciaPortaria" ADD CONSTRAINT "OcorrenciaPortaria_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioPortaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncomendaPortaria" ADD CONSTRAINT "EncomendaPortaria_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioPortaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
