-- Lembrete: "adiar" (soneca). Enquanto adiadoAte estiver no futuro o lembrete
-- some das listas de ativos (painel/lembretes) e reaparece quando a data passa.
-- Não altera o índice parcial lembrete_um_ativo_por_servico (segue resolvido).
ALTER TABLE "Lembrete" ADD COLUMN "adiadoAte" TIMESTAMP(3);
