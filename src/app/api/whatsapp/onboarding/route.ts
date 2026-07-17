import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { getPapelSessao } from '@/lib/session-server';

export const dynamic = 'force-dynamic';

// Finalização do Embedded Signup em modo Coexistence (página
// /whatsapp/conectar). O fluxo da Meta devolve ao navegador um `code` de uso
// único + phone_number_id/waba_id; aqui, no servidor (onde vive o App
// Secret):
//   1. trocamos o code por um access token de negócio (não expira) — GET
//      oauth/access_token;
//   2. assinamos este app nos webhooks da WABA — POST /{waba_id}/subscribed_apps.
// O token é DEVOLVIDO ao admin para ele colocar nas envs
// (WHATSAPP_ACCESS_TOKEN etc.) e fazer o redeploy — o app continua lendo
// credenciais só de env, nada é persistido aqui.

const bodySchema = z.object({
  code: z.string().min(1),
  phoneNumberId: z.string().optional(),
  wabaId: z.string().optional(),
});

export async function POST(request: Request) {
  // Proxy já exige login; revalida o papel aqui (defesa em profundidade).
  if ((await getPapelSessao()) !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!env.NEXT_PUBLIC_META_APP_ID || !env.WHATSAPP_APP_SECRET) {
    return NextResponse.json(
      { error: 'Configure NEXT_PUBLIC_META_APP_ID e WHATSAPP_APP_SECRET antes de conectar.' },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }
  const { code, phoneNumberId, wabaId } = parsed.data;
  const graph = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}`;

  // 1) code → business access token (System User de integração; não expira)
  const tokenUrl =
    `${graph}/oauth/access_token?client_id=${encodeURIComponent(env.NEXT_PUBLIC_META_APP_ID)}` +
    `&client_secret=${encodeURIComponent(env.WHATSAPP_APP_SECRET)}` +
    `&code=${encodeURIComponent(code)}`;
  const tokenRes = await fetch(tokenUrl, { signal: AbortSignal.timeout(20_000) });
  if (!tokenRes.ok) {
    const detalhe = (await tokenRes.text().catch(() => '')).slice(0, 300);
    console.error(`[whatsapp:onboarding] HTTP ${tokenRes.status} na troca do code: ${detalhe}`);
    return NextResponse.json(
      { error: 'Falha ao trocar o código por token. Refaça o fluxo (o código expira rápido).' },
      { status: 502 },
    );
  }
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
  if (!accessToken) {
    return NextResponse.json({ error: 'Meta não devolveu access_token.' }, { status: 502 });
  }

  // 2) assina o app nos webhooks da WABA (messages, smb_message_echoes etc.
  //    conforme os campos marcados no painel do app). Falha aqui não invalida
  //    o token — devolvemos aviso para o admin assinar manualmente.
  let avisoWebhook: string | null = null;
  if (wabaId) {
    const subRes = await fetch(`${graph}/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!subRes.ok) {
      const detalhe = (await subRes.text().catch(() => '')).slice(0, 300);
      console.error(`[whatsapp:onboarding] HTTP ${subRes.status} no subscribed_apps: ${detalhe}`);
      avisoWebhook =
        'Token gerado, mas a assinatura de webhooks na WABA falhou — assine manualmente no painel da Meta (WhatsApp > Configuration).';
    }
  } else {
    avisoWebhook =
      'O fluxo não devolveu o waba_id — assine os webhooks manualmente no painel da Meta.';
  }

  return NextResponse.json({
    accessToken,
    phoneNumberId: phoneNumberId ?? null,
    wabaId: wabaId ?? null,
    avisoWebhook,
  });
}
