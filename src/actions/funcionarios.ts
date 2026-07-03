'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { funcionarioCreateSchema, funcionarioUpdateSchema } from '@/schemas/funcionario';
import type { ActionState } from '@/actions/servicos';

export async function criarFuncionario(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = funcionarioCreateSchema.safeParse({
    nome: formData.get('nome'),
    funcao: formData.get('funcao'),
    contato: formData.get('contato'),
    status: formData.get('status'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  await prisma.funcionario.create({ data: parsed.data });
  revalidatePath('/funcionarios');
  redirect('/funcionarios');
}

export async function atualizarFuncionario(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = funcionarioUpdateSchema.safeParse({
    id: formData.get('id'),
    nome: formData.get('nome'),
    funcao: formData.get('funcao'),
    contato: formData.get('contato'),
    status: formData.get('status'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { id, ...data } = parsed.data;
  await prisma.funcionario.update({ where: { id }, data });
  revalidatePath('/funcionarios');
  redirect('/funcionarios');
}

export async function excluirFuncionario(formData: FormData): Promise<void> {
  const id = z.cuid().parse(formData.get('id'));
  await prisma.funcionario.delete({ where: { id } });
  revalidatePath('/funcionarios');
}
