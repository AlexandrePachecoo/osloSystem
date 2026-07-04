import type { WhatsAppProvider } from '@/lib/whatsapp/provider';
import { MockWhatsAppProvider } from '@/lib/whatsapp/mock-provider';

const provider: WhatsAppProvider = new MockWhatsAppProvider();

// PONTO DE EXTENSÃO: quando o provider real existir (Meta Cloud API ou
// Baileys), selecione aqui — ex.: por env WHATSAPP_PROVIDER.
export function getWhatsAppProvider(): WhatsAppProvider {
  return provider;
}
