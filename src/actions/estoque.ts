'use server';

import { exigirAdmin } from '@/lib/session-server';
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
  await exigirAdmin();
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
  await exigirAdmin();
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
  await exigirAdmin();
  const id = z.cuid().parse(formData.get('id'));
  await prisma.itemEstoque.delete({ where: { id } });
  revalidatePath('/estoque');
}

const movimentarSchema = z.object({
  id: z.cuid(),
  quantidade: z.coerce.number().int('Use um número inteiro').positive('Quantidade deve ser maior que zero'),
  tipo: z.enum(['adicionar', 'retirar']),
});

// Entrada/saída rápida de estoque (widget do painel e assistente).
// Retirada usa updateMany condicionado à quantidade disponível — duas
// retiradas concorrentes nunca deixam o estoque negativo.
export async function movimentarEstoque(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirAdmin();
  const parsed = movimentarSchema.safeParse({
    id: formData.get('id'),
    quantidade: formData.get('quantidade'),
    tipo: formData.get('tipo'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { id, quantidade, tipo } = parsed.data;

  if (tipo === 'adicionar') {
    const atualizados = await prisma.itemEstoque.updateMany({
      where: { id },
      data: { quantidade: { increment: quantidade } },
    });
    if (atualizados.count === 0) return { error: 'Item não encontrado' };
  } else {
    const atualizados = await prisma.itemEstoque.updateMany({
      where: { id, quantidade: { gte: quantidade } },
      data: { quantidade: { decrement: quantidade } },
    });
    if (atualizados.count === 0) {
      const item = await prisma.itemEstoque.findUnique({
        where: { id },
        select: { quantidade: true, unidade: true },
      });
      if (!item) return { error: 'Item não encontrado' };
      return {
        error: `Estoque insuficiente: só há ${item.quantidade} ${item.unidade} disponível.`,
      };
    }
  }

  revalidatePath('/estoque');
  revalidatePath('/');
  return { error: null };
}
