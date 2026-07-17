-- Coexistence (app WhatsApp Business + Cloud API no mesmo número): quando o
-- webhook smb_message_echoes indica que o admin respondeu o contato pelo
-- celular, carimbamos o momento aqui. Informativo — não muda rascunhoStatus.
ALTER TABLE "MensagemWhatsApp" ADD COLUMN "respondidaViaAppEm" TIMESTAMP(3);
