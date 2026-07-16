-- Lembrete: "agendar". Ao criar, o admin pode escolher uma data futura; até lá
-- o lembrete NÃO aparece nas listas de ativos (painel/lembretes) e entra a
-- partir dessa data. Mesma lógica de exibição do adiadoAte.
-- Não altera o índice parcial lembrete_um_ativo_por_servico (segue resolvido).
ALTER TABLE "Lembrete" ADD COLUMN "agendadoPara" TIMESTAMP(3);
