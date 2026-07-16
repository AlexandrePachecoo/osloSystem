import { z } from 'zod';
import { env } from '@/lib/env';
import { Prioridade } from '@/generated/prisma/enums';

// Classificação de prioridade + rascunho de resposta via OpenAI.
// Retorna null em QUALQUER falha (sem API key, timeout, resposta inválida):
// a mensagem entra na fila sem classificação e o admin preenche manualmente
// — o pipeline nunca perde mensagem por causa da OpenAI.

export type ClassificacaoIA = {
  prioridade: Prioridade;
  rascunho: string;
};

const respostaSchema = z.object({
  prioridade: z.enum(Prioridade),
  rascunho: z.string().min(1),
});

const SYSTEM_PROMPT = `Você é o assistente da administração de um condomínio residencial pequeno no Brasil. Você recebe mensagens do grupo de WhatsApp dos moradores e deve:

1. Classificar a prioridade da mensagem:
   - "urgente": risco imediato a pessoas ou ao patrimônio (vazamento de gás, incêndio, invasão, elevador com pessoa presa)
   - "alta": problema afetando moradores agora (elevador parado, falta de água/luz em área comum, portão travado)
   - "media": manutenção ou solicitação normal, sem urgência
   - "baixa": dúvidas, avisos, agradecimentos ou conversa geral

2. Escrever um rascunho de resposta em português do Brasil, com tom cordial e objetivo: educado e direto, sem formalidade excessiva. 1 a 3 frases. Cumprimente a pessoa pelo nome quando fizer sentido. Não invente prazos ou compromissos específicos que a administração talvez não cumpra — prefira "vamos verificar" a "resolveremos hoje às 15h". Não assine a mensagem.

Quando houver "Situação atual do condomínio" abaixo, use essas informações no rascunho: se a mensagem falar de um problema que já tem serviço em andamento, diga que a questão já está sendo tratada; se houver aviso registrado que responda à dúvida (ex.: evento agendado), responda com base nele. Não mencione informações internas irrelevantes para a mensagem.

O rascunho será revisado e editado por um humano antes de qualquer envio.`;

// Reescrita de ocorrência da portaria. Mesma política de falha: retorna null
// em qualquer problema (sem key, timeout, HTTP != 200) — o texto original do
// porteiro segue valendo e o registro nunca é bloqueado pela OpenAI.
const MELHORAR_OCORRENCIA_PROMPT = `Você revisa registros do livro de ocorrências da portaria de um condomínio residencial no Brasil. Reescreva o texto do colaborador em português do Brasil: claro, objetivo e profissional, em terceira pessoa, adequado a um registro formal.

Regras:
- Mantenha TODOS os fatos: nomes, apartamentos, horários, datas, placas, valores.
- Não invente informações, causas ou conclusões que não estejam no texto.
- Datas e horários: se o texto do colaborador JÁ trouxer uma data ou horário, mantenha exatamente o que ele escreveu. Se NÃO houver data nem horário no texto, use a "Data e hora atuais" informada abaixo como o momento do registro — nunca invente outra data.
- Não use markdown, listas ou títulos — apenas o parágrafo (ou parágrafos) do registro.
- Responda somente com o texto reescrito, sem comentários.`;

function dataHoraAtualBRT(agora: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(agora);
}

export async function melhorarTextoOcorrencia(
  texto: string,
  agora: Date = new Date(),
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) {
    console.warn('[openai] OPENAI_API_KEY ausente — melhoria de texto indisponível');
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: `${MELHORAR_OCORRENCIA_PROMPT}\n\nData e hora atuais (use só se o texto não trouxer data/horário): ${dataHoraAtualBRT(agora)}.`,
          },
          { role: 'user', content: texto },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.error(`[openai] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }

    const corpo = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const melhorado = corpo.choices?.[0]?.message?.content?.trim();
    return melhorado || null;
  } catch (error) {
    console.error('[openai] falha na melhoria de texto:', error);
    return null;
  }
}

export async function classificarMensagem(
  autor: string,
  texto: string,
  contexto?: string | null,
): Promise<ClassificacaoIA | null> {
  if (!env.OPENAI_API_KEY) {
    console.warn('[openai] OPENAI_API_KEY ausente — mensagem entra na fila sem classificação');
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: contexto
              ? `${SYSTEM_PROMPT}\n\nSituação atual do condomínio:\n\n${contexto}`
              : SYSTEM_PROMPT,
          },
          { role: 'user', content: `Mensagem de ${autor}:\n\n${texto}` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'classificacao_mensagem',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                prioridade: {
                  type: 'string',
                  enum: ['baixa', 'media', 'alta', 'urgente'],
                },
                rascunho: { type: 'string' },
              },
              required: ['prioridade', 'rascunho'],
              additionalProperties: false,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.error(`[openai] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }

    const corpo = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const conteudo = corpo.choices?.[0]?.message?.content;
    if (!conteudo) return null;

    const parsed = respostaSchema.safeParse(JSON.parse(conteudo));
    if (!parsed.success) {
      console.error('[openai] resposta fora do schema esperado');
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error('[openai] falha na classificação:', error);
    return null;
  }
}

// Resumo executivo do relatório semanal via IA. Recebe o relatório já montado
// (markdown determinístico) e devolve um resumo curto com insights. Mesma
// política de falha das demais: retorna null em qualquer problema — o relatório
// determinístico continua valendo e a página só esconde o bloco de IA.
const RESUMO_RELATORIO_PROMPT = `Você é o assistente da administração de um condomínio residencial pequeno no Brasil. Recebe o relatório semanal já consolidado (serviços por status, prioridades pendentes, lembretes ativos, estoque abaixo do mínimo, movimentações da semana, movimento da portaria — ocorrências e encomendas — e a atividade do grupo de WhatsApp) e produz um resumo executivo para o síndico.

Escreva em português do Brasil, em markdown, com esta estrutura:
- Um parágrafo curto (2 a 4 frases) resumindo como está a semana no geral, cruzando as áreas quando fizer sentido (ex.: uma reclamação recorrente no WhatsApp que ainda não virou serviço, ou uma ocorrência de portaria ligada a um problema em aberto).
- Em seguida, uma lista "**Insights e alertas:**" com 2 a 5 itens objetivos. Destaque padrões que exigem atenção: serviços de alta/urgente parados, lembretes ou problemas que já se arrastam há tempo (ex.: um vazamento em aberto há semanas), estoque crítico, encomendas paradas na portaria, mensagens urgentes dos moradores e gargalos. Se algo estiver bem, pode registrar em no máximo 1 item.

Regras:
- Use SOMENTE os dados do relatório. Não invente números, prazos, nomes ou causas.
- Seja direto e útil para decisão. Sem saudações, sem títulos de nível 1, sem "aqui está o resumo".`;

export async function gerarResumoRelatorioIA(
  relatorioMarkdown: string,
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) {
    console.warn('[openai] OPENAI_API_KEY ausente — resumo do relatório indisponível');
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: RESUMO_RELATORIO_PROMPT },
          { role: 'user', content: relatorioMarkdown },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error(`[openai] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }

    const corpo = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const resumo = corpo.choices?.[0]?.message?.content?.trim();
    return resumo || null;
  } catch (error) {
    console.error('[openai] falha no resumo do relatório:', error);
    return null;
  }
}
