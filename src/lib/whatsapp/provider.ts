// Abstração do canal de WhatsApp. A escolha entre Meta Cloud API oficial e
// Baileys ainda não foi feita — este é o ponto de extensão combinado:
// implemente esta interface e troque em getWhatsAppProvider() (index.ts).
//
// Ingestão: cada provider real terá seu próprio webhook/listener que
// normaliza o payload para MensagemEntrada e chama processarMensagemRecebida
// (pipeline.ts) — o mesmo caminho usado hoje pelo mock e pelo endpoint
// /api/whatsapp/ingest.

export type MensagemEntrada = {
  autor: string;
  texto: string;
  // wa_id/telefone E.164 do remetente — destino ao responder (Cloud API)
  remetente?: string | null;
  // id da mensagem no provider (dedupe na reentrega do webhook)
  externalId?: string | null;
  recebidaEm?: Date;
};

export interface WhatsAppProvider {
  readonly nome: string;
  /**
   * Envia a resposta aprovada ao contato de origem.
   * Chamada SOMENTE pela ação manual "Marcar como enviada" — nada é
   * enviado automaticamente.
   * @param remetente wa_id/telefone de destino; nulo em mensagens antigas/mock.
   */
  enviarResposta(
    mensagemId: string,
    remetente: string | null,
    texto: string,
  ): Promise<void>;
}
