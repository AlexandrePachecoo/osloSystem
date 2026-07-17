'use server';

import { z } from 'zod';
import { exigirAdmin } from '@/lib/session-server';
import { prisma } from '@/lib/prisma';
import { enviarPushParaTodos, pushConfigurado } from '@/lib/push';

export type PushResult = { ok: boolean; error?: string };

// A inscrição vem do browser (PushSubscription serializado). Validamos o
// formato mínimo antes de gravar.
const inscricaoSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function salvarInscricaoPush(sub: unknown): Promise<PushResult> {
  await exigirAdmin();
  const parsed = inscricaoSchema.safeParse(sub);
  if (!parsed.success) return { ok: false, error: 'Inscrição inválida' };

  const { endpoint, keys } = parsed.data;
  // Upsert por endpoint: reassinar no mesmo dispositivo não duplica.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { p256dh: keys.p256dh, auth: keys.auth },
  });
  return { ok: true };
}

export async function removerInscricaoPush(endpoint: string): Promise<PushResult> {
  await exigirAdmin();
  if (typeof endpoint !== 'string' || !endpoint) {
    return { ok: false, error: 'Endpoint inválido' };
  }
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true };
}

// Dispara uma notificação de teste para todos os dispositivos inscritos —
// usada pelo botão "Enviar teste" para o admin confirmar que está tudo certo.
export async function enviarPushTeste(): Promise<PushResult> {
  await exigirAdmin();
  if (!pushConfigurado()) {
    return { ok: false, error: 'Notificações não configuradas no servidor.' };
  }
  const { enviados } = await enviarPushParaTodos({
    title: 'Oslo',
    body: 'Notificações ativadas ✅',
    url: '/',
    tag: 'teste',
  });
  if (enviados === 0) {
    return { ok: false, error: 'Nenhum dispositivo inscrito recebeu o teste.' };
  }
  return { ok: true };
}
