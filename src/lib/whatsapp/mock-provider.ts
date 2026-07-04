import type { WhatsAppProvider } from '@/lib/whatsapp/provider';

// Implementação stub: não envia nada para lugar nenhum, apenas registra no
// log do servidor. Substituída pelo provider real (Meta Cloud API ou
// Baileys) quando a decisão for tomada.
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly nome = 'mock';

  async enviarResposta(mensagemId: string, autor: string, texto: string): Promise<void> {
    console.log(
      `[whatsapp:mock] resposta marcada como enviada (nenhum envio real) — mensagem=${mensagemId} autor=${autor} texto="${texto.slice(0, 80)}"`,
    );
  }
}
