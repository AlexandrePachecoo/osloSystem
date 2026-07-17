'use server';

import { exigirAdmin } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { orcamentoCreateSchema, orcamentoIdSchema } from '@/schemas/orcamento';

export type ActionState = { error: string | null };

export async function adicionarOrcamento(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirAdmin();
  const parsed = orcamentoCreateSchema.safeParse({
    servicoId: formData.get('servicoId'),
    fornecedor: formData.get('fornecedor'),
    valor: formData.get('valor'),
    observacoes: formData.get('observacoes'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.orcamento.create({ data: parsed.data });

  revalidatePath(`/servicos/${parsed.data.servicoId}`);
  return { error: null };
}

export async function removerOrcamento(formData: FormData): Promise<void> {
  await exigirAdmin();
  const parsed = orcamentoIdSchema.safeParse({
    id: formData.get('id'),
    servicoId: formData.get('servicoId'),
  });
  if (!parsed.success) return;

  await prisma.orcamento.delete({ where: { id: parsed.data.id } });
  revalidatePath(`/servicos/${parsed.data.servicoId}`);
}

// Marca um orçamento como escolhido e desmarca os demais do mesmo serviço.
// Clicar de novo no já selecionado desfaz a escolha.
// Ao escolher, os dados da proposta passam a ser os do serviço: valor vira o
// orçamento do serviço e o fornecedor vira a empresa (vinculada ao cadastro
// quando o nome bate, senão como texto livre). Desmarcar não mexe no serviço.
export async function selecionarOrcamento(formData: FormData): Promise<void> {
  await exigirAdmin();
  const parsed = orcamentoIdSchema.safeParse({
    id: formData.get('id'),
    servicoId: formData.get('servicoId'),
  });
  if (!parsed.success) return;
  const { id, servicoId } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const alvo = await tx.orcamento.findUnique({
      where: { id },
      select: { selecionado: true, servicoId: true, fornecedor: true, valor: true },
    });
    if (!alvo || alvo.servicoId !== servicoId) return;

    await tx.orcamento.updateMany({
      where: { servicoId, selecionado: true },
      data: { selecionado: false },
    });
    if (!alvo.selecionado) {
      await tx.orcamento.update({ where: { id }, data: { selecionado: true } });

      const empresa = await tx.empresa.findFirst({
        where: { nome: { equals: alvo.fornecedor.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      await tx.servico.update({
        where: { id: servicoId },
        data: {
          valorOrcamento: alvo.valor,
          empresaId: empresa?.id ?? null,
          empresaNome: empresa ? null : alvo.fornecedor,
        },
      });
    }
  });

  revalidatePath(`/servicos/${servicoId}`);
  revalidatePath('/servicos');
}
