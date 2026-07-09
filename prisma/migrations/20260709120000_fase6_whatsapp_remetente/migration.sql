-- MensagemWhatsApp: telefone/wa_id do remetente, destino da resposta enviada
-- pela Cloud API. Nulo para mensagens antigas ou simuladas via mock.
ALTER TABLE "MensagemWhatsApp" ADD COLUMN "remetente" TEXT;
