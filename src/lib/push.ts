import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

// Web Push (PWA). Envio server-side de notificações para todos os dispositivos
// inscritos. Fica inerte sem o par de chaves VAPID — as demais features do app
// continuam normais (mesmo padrão de degradação da OpenAI/WhatsApp).

export type PushPayload = {
  title: string;
  body: string;
  // Rota aberta ao tocar na notificação (default '/').
  url?: string;
  // Agrupa/coalesce notificações do mesmo tipo no dispositivo.
  tag?: string;
};

export function pushConfigurado(): boolean {
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

let vapidPronto = false;
function garantirVapid() {
  if (vapidPronto || !pushConfigurado()) return;
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
  vapidPronto = true;
}

// Envia o payload para todas as inscrições. Endpoints mortos (404/410) são
// removidos do banco para a base não acumular lixo. Nunca lança — falha de
// notificação não pode derrubar o cron nem a ingestão de mensagens.
export async function enviarPushParaTodos(
  payload: PushPayload,
): Promise<{ enviados: number; removidos: number }> {
  if (!pushConfigurado()) return { enviados: 0, removidos: 0 };
  garantirVapid();

  const inscricoes = await prisma.pushSubscription.findMany();
  if (inscricoes.length === 0) return { enviados: 0, removidos: 0 };

  const corpo = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag,
    icon: '/icon-192.png',
    badge: '/badge.png',
  });

  let enviados = 0;
  let removidos = 0;

  await Promise.all(
    inscricoes.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          corpo,
        );
        enviados += 1;
      } catch (erro) {
        const status = (erro as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .delete({ where: { endpoint: s.endpoint } })
            .catch(() => undefined);
          removidos += 1;
        } else {
          console.error('[push] falha ao enviar notificação:', status, erro);
        }
      }
    }),
  );

  return { enviados, removidos };
}
