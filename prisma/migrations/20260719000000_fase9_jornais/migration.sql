-- Fase 9 — Jornais: controle de entrega de jornais nos apartamentos assinantes.
-- Cada jornal tem uma lista fixa de apartamentos; a portaria marca no dia quais
-- foram entregues. O envio do relatório zera as marcações (entregue = false).

-- CreateTable
CREATE TABLE "JornalPortaria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "torre" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JornalPortaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JornalAptoPortaria" (
    "id" TEXT NOT NULL,
    "jornalId" TEXT NOT NULL,
    "apto" TEXT NOT NULL,
    "entregue" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JornalAptoPortaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JornalPortaria_torre_idx" ON "JornalPortaria"("torre");

-- CreateIndex
CREATE INDEX "JornalAptoPortaria_jornalId_idx" ON "JornalAptoPortaria"("jornalId");

-- AddForeignKey
ALTER TABLE "JornalAptoPortaria" ADD CONSTRAINT "JornalAptoPortaria_jornalId_fkey" FOREIGN KEY ("jornalId") REFERENCES "JornalPortaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
