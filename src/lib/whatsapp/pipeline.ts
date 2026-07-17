import { prisma } from '@/lib/prisma';
import { classificarMensagem } from '@/lib/openai';
import { montarContextoSistema } from '@/lib/contexto-ia';
import { enviarPushParaTodos } from '@/lib/push';
import { PRIORIDADE_LABEL } from '@/lib/format';
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
      remetente: entrada.remetente ?? null,
      externalId: entrada.externalId ?? null,
      recebidaEm: entrada.recebidaEm ?? new Date(),
    },
  });

  // A IA responde olhando o estado do sistema: serviços em aberto e avisos
  // registrados pela administração. Falha ao montar o contexto não derruba a
  // classificação — segue sem contexto.
  const contexto = await montarContextoSistema().catch((error) => {
    console.error('[whatsapp] falha ao montar contexto do sistema:', error);
    return null;
  });

  const classificacao = await classificarMensagem(entrada.autor, entrada.texto, contexto);

  const atualizada = classificacao
    ? await prisma.mensagemWhatsApp.update({
        where: { id: mensagem.id },
        data: {
          prioridade: classificacao.prioridade,
          rascunhoResposta: classificacao.rascunho,
        },
      })
    : mensagem;

  // Notifica o admin de que há uma mensagem nova aguardando aprovação. A
  // classificação (se houve) entra no corpo. Falha de push nunca derruba a
  // ingestão — enviarPushParaTodos já engole os erros internamente.
  const prioridade = atualizada.prioridade;
  await enviarPushParaTodos({
    title: prioridade
      ? `WhatsApp — ${PRIORIDADE_LABEL[prioridade]}`
      : 'WhatsApp — nova mensagem',
    body: `${atualizada.autor}: ${resumir(atualizada.textoOriginal)}`,
    url: '/whatsapp',
    tag: 'whatsapp',
  }).catch((erro) => console.error('[whatsapp] falha ao notificar:', erro));

  return { mensagem: atualizada, duplicada: false };
}

// Encurta o texto para caber no corpo da notificação.
function resumir(texto: string, max = 120): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}
