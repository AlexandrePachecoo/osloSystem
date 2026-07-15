'use server';

import { exigirAdmin } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { processarMensagemRecebida } from '@/lib/whatsapp/pipeline';
import { getWhatsAppProvider } from '@/lib/whatsapp';
import {
  mensagemIngestSchema,
  atualizarRascunhoSchema,
  mensagemIdSchema,
} from '@/schemas/mensagem';
import type { ActionState } from '@/actions/servicos';
import type { RascunhoStatus } from '@/generated/prisma/enums';

// Transições válidas do rascunho — tudo manual, nada automático:
//   pendente → aprovado | descartado
//   aprovado → enviado | descartado
const TRANSICOES_RASCUNHO: Record<RascunhoStatus, readonly RascunhoStatus[]> = {
  pendente: ['aprovado', 'descartado'],
  aprovado: ['enviado', 'descartado'],
  enviado: [],
  descartado: [],
};

export async function simularMensagemRecebida(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirAdmin();
  const parsed = mensagemIngestSchema.safeParse({
    autor: formData.get('autor'),
    texto: formData.get('texto'),
    externalId: formData.get('externalId') ?? null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await processarMensagemRecebida({
    autor: parsed.data.autor,
    texto: parsed.data.texto,
    externalId: parsed.data.externalId,
  });
  revalidatePath('/whatsapp');
  return { error: null };
}

export async function atualizarRascunho(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirAdmin();
  const parsed = atualizarRascunhoSchema.safeParse({
    id: formData.get('id'),
    prioridade: formData.get('prioridade') || null,
    rascunhoResposta: formData.get('rascunhoResposta'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { id, ...data } = parsed.data;
  const mensagem = await prisma.mensagemWhatsApp.findUnique({
    where: { id },
    select: { rascunhoStatus: true },
  });
  if (!mensagem) return { error: 'Mensagem não encontrada' };
  if (mensagem.rascunhoStatus === 'enviado' || mensagem.rascunhoStatus === 'descartado') {
    return { error: 'Mensagem encerrada não pode ser editada' };
  }

  await prisma.mensagemWhatsApp.update({ where: { id }, data });
  revalidatePath('/whatsapp');
  return { error: null };
}

async function mudarStatusRascunho(
  formData: FormData,
  para: RascunhoStatus,
): Promise<ActionState> {
  const parsed = mensagemIdSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { error: 'Id inválido' };

  // Aprovar/enviar salvam antes as edições feitas no form, para o clique
  // direto no botão não perder texto editado do rascunho.
  if (para === 'aprovado' || para === 'enviado') {
    const edicao = atualizarRascunhoSchema.safeParse({
      id: formData.get('id'),
      prioridade: formData.get('prioridade') || null,
      rascunhoResposta: formData.get('rascunhoResposta'),
    });
    if (edicao.success) {
      const { id, ...data } = edicao.data;
      await prisma.mensagemWhatsApp
        .update({ where: { id }, data })
        .catch(() => undefined); // mensagem inexistente cai na checagem abaixo
    }
  }

  const mensagem = await prisma.mensagemWhatsApp.findUnique({
    where: { id: parsed.data.id },
  });
  if (!mensagem) return { error: 'Mensagem não encontrada' };
  if (!TRANSICOES_RASCUNHO[mensagem.rascunhoStatus].includes(para)) {
    return { error: `Transição inválida: ${mensagem.rascunhoStatus} → ${para}` };
  }
  if (para === 'aprovado' && !mensagem.rascunhoResposta) {
    return { error: 'Escreva um rascunho antes de aprovar' };
  }

  if (para === 'enviado') {
    // PONTO DE ENVIO REAL: disparado APENAS por esta ação manual. Com
    // WHATSAPP_PROVIDER=meta, envia de verdade pela Cloud API; caso contrário
    // o mock só loga. O provider real precisa do telefone de destino — sem
    // ele (mensagens antigas ou simuladas), não dá para enviar.
    const provider = getWhatsAppProvider();
    if (provider.nome !== 'mock' && !mensagem.remetente) {
      return {
        error: 'Sem telefone do remetente — não é possível enviar pela Cloud API.',
      };
    }
    try {
      await provider.enviarResposta(
        mensagem.id,
        mensagem.remetente,
        mensagem.rascunhoResposta ?? '',
      );
    } catch (erro) {
      console.error('[whatsapp] falha ao enviar resposta:', erro);
      return { error: 'Falha ao enviar a resposta pelo WhatsApp. Tente novamente.' };
    }
  }

  await prisma.mensagemWhatsApp.update({
    where: { id: mensagem.id },
    data: { rascunhoStatus: para },
  });
  revalidatePath('/whatsapp');
  return { error: null };
}

export async function aprovarRascunho(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirAdmin();
  return mudarStatusRascunho(formData, 'aprovado');
}

export async function marcarComoEnviada(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirAdmin();
  return mudarStatusRascunho(formData, 'enviado');
}

export async function descartarRascunho(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirAdmin();
  return mudarStatusRascunho(formData, 'descartado');
}
