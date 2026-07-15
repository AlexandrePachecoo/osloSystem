'use server';

import { exigirAdmin } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { empresaCreateSchema, empresaUpdateSchema } from '@/schemas/empresa';
import type { ActionState } from '@/actions/servicos';

export async function criarEmpresa(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirAdmin();
  const parsed = empresaCreateSchema.safeParse({
    nome: formData.get('nome'),
    contato: formData.get('contato'),
    categoria: formData.get('categoria'),
    observacoes: formData.get('observacoes'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  await prisma.empresa.create({ data: parsed.data });
  revalidatePath('/empresas');
  redirect('/empresas');
}

export async function atualizarEmpresa(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirAdmin();
  const parsed = empresaUpdateSchema.safeParse({
    id: formData.get('id'),
    nome: formData.get('nome'),
    contato: formData.get('contato'),
    categoria: formData.get('categoria'),
    observacoes: formData.get('observacoes'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { id, ...data } = parsed.data;
  await prisma.empresa.update({ where: { id }, data });
  revalidatePath('/empresas');
  redirect('/empresas');
}

// Excluir empresa não apaga serviços: a FK é SetNull (histórico preservado).
export async function excluirEmpresa(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = z.cuid().parse(formData.get('id'));
  await prisma.empresa.delete({ where: { id } });
  revalidatePath('/empresas');
  revalidatePath('/servicos');
}
