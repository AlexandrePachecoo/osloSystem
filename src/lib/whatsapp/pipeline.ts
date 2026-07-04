import { prisma } from '@/lib/prisma';
import { classificarMensagem } from '@/lib/openai';
import type { MensagemEntrada } from '@/lib/whatsapp/provider';

// Pipeline de ingestão: mensagem recebida → salva → classifica prioridade e
// gera rascunho via OpenAI → atualiza. A mensagem é persistida ANTES da
// chamada à OpenAI para nunca ser perdida por falha da IA; nesse caso ela
// fica pendente sem prioridade/rascunho e o admin preenche manualmente.
export async function processarMensagemRecebida(entrada: MensagemEntrada) {
  // dedupe por externalId (reentrega de webhook): devolve a existente
  if (entrada.externalId) {
    const existente = await prisma.mensagemWhatsApp.findUnique({
      where: { externalId: entrada.externalId },
    });
    if (existente) return { mensagem: existente, duplicada: true };
  }

  const mensagem = await prisma.mensagemWhatsApp.create({
    data: {
      autor: entrada.autor,
      textoOriginal: entrada.texto,
      externalId: entrada.externalId ?? null,
      recebidaEm: entrada.recebidaEm ?? new Date(),
    },
  });

  const classificacao = await classificarMensagem(entrada.autor, entrada.texto);
  if (!classificacao) {
    return { mensagem, duplicada: false };
  }

  const atualizada = await prisma.mensagemWhatsApp.update({
    where: { id: mensagem.id },
    data: {
      prioridade: classificacao.prioridade,
      rascunhoResposta: classificacao.rascunho,
    },
  });
  return { mensagem: atualizada, duplicada: false };
}
