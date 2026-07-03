'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export async function resolverLembrete(formData: FormData): Promise<void> {
  const id = z.cuid().parse(formData.get('id'));
  await prisma.lembrete.update({ where: { id }, data: { resolvido: true } });
  revalidatePath('/lembretes');
  revalidatePath('/');
}
