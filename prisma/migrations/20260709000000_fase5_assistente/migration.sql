-- Servico: intervalo de lembrete por serviço e empresa avulsa (não cadastrada)
ALTER TABLE "Servico" ADD COLUMN "lembreteDias" INTEGER;
ALTER TABLE "Servico" ADD COLUMN "empresaNome" TEXT;

-- Lembrete: lembretes manuais sem serviço vinculado.
-- O índice parcial lembrete_um_ativo_por_servico segue válido: NULLs não
-- colidem em índice único no Postgres.
ALTER TABLE "Lembrete" ALTER COLUMN "servicoId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "NotaContexto" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaContexto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotaContexto_ativo_idx" ON "NotaContexto"("ativo");
