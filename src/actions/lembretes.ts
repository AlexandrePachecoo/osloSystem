'use server';

import { exigirAdmin } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { ActionState } from '@/actions/servicos';

export async function resolverLembrete(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = z.cuid().parse(formData.get('id'));
  await prisma.lembrete.update({ where: { id }, data: { resolvido: true } });
  revalidatePath('/lembretes');
  revalidatePath('/');
}

const criarLembreteSchema = z.object({
  mensagem: z.string().trim().min(1, 'Escreva a mensagem do lembrete').max(1000),
  servicoId: z
    .string()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
});

// Lembrete manual criado pelo admin — com ou sem serviço vinculado.
// O índice parcial permite só 1 lembrete ativo por serviço; lembretes sem
// serviço (servicoId null) não colidem entre si.
export async function criarLembrete(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await exigirAdmin();
  const parsed = criarLembreteSchema.safeParse({
    mensagem: formData.get('mensagem'),
    servicoId: formData.get('servicoId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await prisma.lembrete.create({ data: parsed.data });
  } catch {
    return {
      error: 'Este serviço já tem um lembrete ativo. Resolva-o antes de criar outro.',
    };
  }

  revalidatePath('/lembretes');
  revalidatePath('/');
  return { error: null };
}
