import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { processarMensagemRecebida } from '@/lib/whatsapp/pipeline';
import type { MensagemEntrada } from '@/lib/whatsapp/provider';

export const dynamic = 'force-dynamic';

// Webhook da Meta WhatsApp Cloud API.
//
// GET  → handshake de verificação: a Meta chama uma vez ao configurar a URL,
//        esperando de volta o hub.challenge se o hub.verify_token bater.
// POST → mensagens recebidas: valida a assinatura X-Hub-Signature-256 com o
//        App Secret, normaliza cada mensagem de texto e reusa o pipeline
//        (mesmo caminho do endpoint /ingest e do mock). Só DMs de texto —
//        grupos não são suportados pela Cloud API; mídia e status são ignorados.

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new Response('forbidden', { status: 403 });
}

// Valida X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(rawBody, appSecret).
function assinaturaValida(rawBody: string, assinatura: string | null): boolean {
  if (!env.WHATSAPP_APP_SECRET || !assinatura) return false;
  const esperado =
    'sha256=' + createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Estrutura relevante do payload da Cloud API (só o que consumimos).
type WebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
};

export async function POST(request: Request) {
  // Corpo cru: a assinatura é sobre os bytes exatos, então lemos texto antes
  // de qualquer parse.
  const rawBody = await request.text();
  if (!assinaturaValida(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // Erros de processamento são logados mas nunca viram 5xx: a Meta re-entrega
  // em não-2xx e o dedupe por externalId protege contra duplicação.
  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;

        // Mapa wa_id → nome de perfil, para exibir o autor legível na fila.
        const nomes = new Map<string, string>();
        for (const c of value.contacts ?? []) {
          if (c.wa_id && c.profile?.name) nomes.set(c.wa_id, c.profile.name);
        }

        for (const msg of value.messages) {
          if (msg.type !== 'text' || !msg.text?.body || !msg.from) continue;
          const entrada: MensagemEntrada = {
            autor: nomes.get(msg.from) ?? msg.from,
            texto: msg.text.body,
            remetente: msg.from,
            externalId: msg.id ?? null,
          };
          await processarMensagemRecebida(entrada);
        }
      }
    }
  } catch (erro) {
    console.error('[whatsapp:webhook] falha ao processar payload:', erro);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
