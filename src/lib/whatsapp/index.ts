import { env } from '@/lib/env';
import type { WhatsAppProvider } from '@/lib/whatsapp/provider';
import { MockWhatsAppProvider } from '@/lib/whatsapp/mock-provider';
import { MetaWhatsAppProvider } from '@/lib/whatsapp/meta-provider';

// Seleção do provider por env WHATSAPP_PROVIDER. "meta" só é ativado se as
// credenciais obrigatórias existirem; faltando alguma, loga aviso e cai no
// mock (o app continua funcionando, só sem envio real). Instanciado uma vez.
function criarProvider(): WhatsAppProvider {
  if (env.WHATSAPP_PROVIDER === 'meta') {
    if (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
      return new MetaWhatsAppProvider(
        env.WHATSAPP_ACCESS_TOKEN,
        env.WHATSAPP_PHONE_NUMBER_ID,
      );
    }
    console.warn(
      '[whatsapp] WHATSAPP_PROVIDER=meta mas faltam WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID — usando mock',
    );
  }
  return new MockWhatsAppProvider();
}

const provider: WhatsAppProvider = criarProvider();

export function getWhatsAppProvider(): WhatsAppProvider {
  return provider;
}
