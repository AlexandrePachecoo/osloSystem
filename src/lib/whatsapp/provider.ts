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
  // id da mensagem no provider (dedupe na reentrega do webhook)
  externalId?: string | null;
  recebidaEm?: Date;
};

export interface WhatsAppProvider {
  readonly nome: string;
  /**
   * Envia a resposta aprovada ao grupo/contato de origem.
   * Chamada SOMENTE pela ação manual "Marcar como enviada" — nada é
   * enviado automaticamente.
   */
  enviarResposta(mensagemId: string, autor: string, texto: string): Promise<void>;
}
