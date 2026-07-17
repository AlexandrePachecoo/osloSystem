import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { processarMensagemRecebida } from '@/lib/whatsapp/pipeline';
import type { MensagemEntrada } from '@/lib/whatsapp/provider';

export const dynamic = 'force-dynamic';

// Webhook da Meta WhatsApp Cloud API — com suporte a Coexistence (número
// compartilhado entre o app WhatsApp Business e a Cloud API).
//
// GET  → handshake de verificação: a Meta chama uma vez ao configurar a URL,
//        esperando de volta o hub.challenge se o hub.verify_token bater.
// POST → dois campos tratados:
//        - `messages`: mensagens recebidas. Valida a assinatura
//          X-Hub-Signature-256 com o App Secret, normaliza cada mensagem de
//          texto e reusa o pipeline (mesmo caminho do /ingest e do mock).
//          Só DMs de texto — grupos não sincronizam com a Cloud API (no
//          Coexistence eles continuam funcionando SÓ no app); mídia e status
//          são ignorados.
//        - `smb_message_echoes` (Coexistence): eco de mensagem que o admin
//          enviou pelo próprio celular (app Business). Carimbamos
//          respondidaViaAppEm nas mensagens abertas daquele contato para a
//          fila mostrar "já respondida pelo celular" — o status do rascunho
//          NÃO muda sozinho (princípio do sistema: nada automático).

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
      field?: string;
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
        // Coexistence: mensagens enviadas pelo app Business/aparelho vinculado
        message_echoes?: {
          id?: string;
          from?: string;
          to?: string;
          timestamp?: string;
          type?: string;
        }[];
      };
    }[];
  }[];
};

// Eco do app (Coexistence): o admin respondeu `to` pelo celular. Marca as
// mensagens ainda abertas desse contato — idempotente na reentrega (updateMany
// sobre as mesmas linhas produz o mesmo estado).
async function registrarEcoDoApp(echo: { to?: string; timestamp?: string }) {
  if (!echo.to) return; // sem destino identificável, nada a marcar
  const ts = Number(echo.timestamp);
  const respondidaEm = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date();
  await prisma.mensagemWhatsApp.updateMany({
    where: {
      remetente: echo.to,
      rascunhoStatus: { in: ['pendente', 'aprovado'] },
    },
    data: { respondidaViaAppEm: respondidaEm },
  });
}

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

        // Coexistence: respostas dadas pelo celular chegam como echoes.
        if (change.field === 'smb_message_echoes') {
          for (const echo of value?.message_echoes ?? []) {
            await registrarEcoDoApp(echo);
          }
          continue;
        }

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
