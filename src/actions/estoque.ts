'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { itemEstoqueCreateSchema, itemEstoqueUpdateSchema } from '@/schemas/estoque';
import type { ActionState } from '@/actions/servicos';

export async function criarItemEstoque(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = itemEstoqueCreateSchema.safeParse({
    nome: formData.get('nome'),
    quantidade: formData.get('quantidade'),
    quantidadeMinima: formData.get('quantidadeMinima'),
    unidade: formData.get('unidade'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  await prisma.itemEstoque.create({ data: parsed.data });
  revalidatePath('/estoque');
  redirect('/estoque');
}

export async function atualizarItemEstoque(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = itemEstoqueUpdateSchema.safeParse({
    id: formData.get('id'),
    nome: formData.get('nome'),
    quantidade: formData.get('quantidade'),
    quantidadeMinima: formData.get('quantidadeMinima'),
    unidade: formData.get('unidade'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { id, ...data } = parsed.data;
  await prisma.itemEstoque.update({ where: { id }, data });
  revalidatePath('/estoque');
  redirect('/estoque');
}

export async function excluirItemEstoque(formData: FormData): Promise<void> {
  const id = z.cuid().parse(formData.get('id'));
  await prisma.itemEstoque.delete({ where: { id } });
  revalidatePath('/estoque');
}
