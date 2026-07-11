-- Orcamento: propostas concorrentes de um serviço (empresa/fornecedor + valor).
-- Permite comparar mais de um orçamento por serviço e marcar o escolhido.
CREATE TABLE "Orcamento" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "observacoes" TEXT,
    "selecionado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Orcamento_servicoId_idx" ON "Orcamento"("servicoId");

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
