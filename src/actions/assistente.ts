'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { conversarComAssistente, type ChatTurno } from '@/lib/assistente';
import type { ActionState } from '@/actions/servicos';

const historicoSchema = z
  .array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(4000),
    }),
  )
  .min(1)
  .max(30);

export type ChatResultado = { resposta: string; erro: null } | { resposta: null; erro: string };

export async function enviarMensagemAssistente(
  historico: ChatTurno[],
): Promise<ChatResultado> {
  const parsed = historicoSchema.safeParse(historico);
  if (!parsed.success) {
    return { resposta: null, erro: 'Mensagem inválida' };
  }

  const resultado = await conversarComAssistente(parsed.data);
  if ('erro' in resultado) {
    return { resposta: null, erro: resultado.erro };
  }

  // O assistente pode ter criado serviços, lembretes, notas ou movimentado
  // estoque — revalida as áreas afetadas.
  revalidatePath('/');
  revalidatePath('/servicos');
  revalidatePath('/lembretes');
  revalidatePath('/estoque');
  return { resposta: resultado.resposta, erro: null };
}

const notaSchema = z.object({
  texto: z.string().trim().min(1, 'Escreva a informação').max(2000),
});

// Alimentação direta de contexto (sem passar pelo chat): o texto entra no
// que a IA sabe ao responder moradores no WhatsApp e no assistente.
export async function criarNotaContexto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = notaSchema.safeParse({ texto: formData.get('texto') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  await prisma.notaContexto.create({ data: parsed.data });
  revalidatePath('/');
  return { error: null };
}

export async function desativarNotaContexto(formData: FormData): Promise<void> {
  const id = z.cuid().parse(formData.get('id'));
  await prisma.notaContexto.update({ where: { id }, data: { ativo: false } });
  revalidatePath('/');
}
