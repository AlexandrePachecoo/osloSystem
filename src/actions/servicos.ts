'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { validarTransicao, TransicaoInvalidaError, STATUS_TERMINAIS } from '@/domain/servico-status';
import { servicoCreateSchema, servicoUpdateSchema, mudarStatusSchema } from '@/schemas/servico';

export type ActionState = { error: string | null };

function primeiroErro(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Erro inesperado';
}

export async function criarServico(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = servicoCreateSchema.safeParse({
    titulo: formData.get('titulo'),
    descricao: formData.get('descricao'),
    valorOrcamento: formData.get('valorOrcamento') || null,
    prioridade: formData.get('prioridade'),
    empresaId: formData.get('empresaId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const servico = await prisma.$transaction(async (tx) => {
    const criado = await tx.servico.create({ data: parsed.data });
    await tx.servicoStatusLog.create({
      data: { servicoId: criado.id, deStatus: null, paraStatus: criado.status },
    });
    return criado;
  });

  revalidatePath('/servicos');
  redirect(`/servicos/${servico.id}`);
}

export async function atualizarServico(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = servicoUpdateSchema.safeParse({
    id: formData.get('id'),
    titulo: formData.get('titulo'),
    descricao: formData.get('descricao'),
    valorOrcamento: formData.get('valorOrcamento') || null,
    prioridade: formData.get('prioridade'),
    empresaId: formData.get('empresaId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { id, ...data } = parsed.data;
  await prisma.servico.update({ where: { id }, data });

  revalidatePath('/servicos');
  revalidatePath(`/servicos/${id}`);
  redirect(`/servicos/${id}`);
}

export async function mudarStatusServico(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = mudarStatusSchema.safeParse({
    id: formData.get('id'),
    paraStatus: formData.get('paraStatus'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { id, paraStatus } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const servico = await tx.servico.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      validarTransicao(servico.status, paraStatus);

      await tx.servico.update({
        where: { id },
        data: { status: paraStatus, statusChangedAt: new Date() },
      });
      await tx.servicoStatusLog.create({
        data: { servicoId: id, deStatus: servico.status, paraStatus },
      });
      // O serviço andou: lembretes de inatividade pendentes deixam de valer.
      await tx.lembrete.updateMany({
        where: { servicoId: id, resolvido: false },
        data: { resolvido: true },
      });
    });
  } catch (error) {
    if (error instanceof TransicaoInvalidaError) {
      return { error: error.message };
    }
    return { error: primeiroErro(error) };
  }

  revalidatePath('/servicos');
  revalidatePath(`/servicos/${id}`);
  revalidatePath('/lembretes');
  revalidatePath('/');
  return { error: null };
}

export async function excluirServico(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  // Só permite excluir serviços encerrados ou ainda em orçamento — os demais
  // devem passar pelo fluxo de status para manter o histórico coerente.
  const servico = await prisma.servico.findUnique({ where: { id }, select: { status: true } });
  if (!servico) return;
  if (!STATUS_TERMINAIS.includes(servico.status) && servico.status !== 'orcamento') {
    return;
  }
  await prisma.servico.delete({ where: { id } });
  revalidatePath('/servicos');
  redirect('/servicos');
}
