import { env } from '@/lib/env';
import type { WhatsAppProvider } from '@/lib/whatsapp/provider';

// Provider real: Meta WhatsApp Cloud API (Graph API). Envia a resposta
// aprovada como mensagem de texto para o número de origem.
//
// Janela de 24h: a Cloud API só permite texto livre dentro de 24h após a
// última mensagem do contato. Como o admin responde a DMs recebidas de
// moradores, a janela quase sempre está aberta. Fora dela a API rejeita o
// envio (erro logado e propagado para a action mostrar ao admin) — nesse
// caso seria necessário um template message aprovado (fora de escopo).
//
// Grupos NÃO são suportados pela Cloud API — este provider trata só DMs 1:1.
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly nome = 'meta';

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
    private readonly graphVersion: string = env.WHATSAPP_GRAPH_VERSION,
  ) {}

  async enviarResposta(
    mensagemId: string,
    remetente: string | null,
    texto: string,
  ): Promise<void> {
    if (!remetente) {
      throw new Error(`mensagem ${mensagemId} sem remetente — nada para enviar`);
    }

    const url = `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: remetente,
        type: 'text',
        text: { body: texto },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const detalhe = (await res.text().catch(() => '')).slice(0, 300);
      console.error(`[whatsapp:meta] HTTP ${res.status} ao enviar: ${detalhe}`);
      throw new Error(`Cloud API respondeu ${res.status}`);
    }
  }
}
