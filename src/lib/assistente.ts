import { z } from 'zod';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { montarContextoSistema } from '@/lib/contexto-ia';
import { Prioridade } from '@/generated/prisma/enums';

// Assistente de gerenciamento do painel: conversa com o admin e executa
// ações no sistema via function calling da OpenAI. Exemplos:
//   "Está acontecendo um vazamento no S2, o funcionário da empresa X já está
//    resolvendo" → cria um serviço em andamento.
//   "Aviso no grupo: festa junina no salão dia 12/09 às 19h" → salva uma nota
//    de contexto que passa a alimentar as respostas do WhatsApp.

export type ChatTurno = { role: 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `Você é o assistente de gerenciamento da administração de um condomínio residencial pequeno no Brasil, dentro do sistema Oslo. Você conversa com o administrador (síndico) e executa ações no sistema usando as ferramentas disponíveis.

Regras:
- Responda sempre em português do Brasil, curto e direto (1 a 4 frases).
- Quando o administrador relatar um fato que corresponde a uma ação (problema sendo resolvido → criar serviço; aviso/informação para os moradores → salvar contexto; coisa a não esquecer → criar lembrete; material usado/comprado → movimentar estoque), execute a ação em vez de apenas responder.
- Um lembrete pode ser agendado para uma data futura ("me lembra de cobrar a empresa X dia 20", "semana que vem"): calcule a data absoluta (YYYY-MM-DD) a partir da data atual informada e passe em agendadoPara. Sem data explícita, deixe null (vale desde já).
- Um problema que JÁ está sendo resolvido entra como serviço "em_andamento"; um problema novo ainda sem solução contratada entra como "orcamento".
- Avisos e informações gerais (eventos, obras, mudanças de regra) devem ser salvos como contexto: eles alimentam as respostas automáticas do WhatsApp aos moradores.
- Depois de executar uma ação, confirme em uma frase o que foi feito.
- Se faltar informação essencial (ex.: título do serviço impossível de deduzir), pergunte antes de agir. Não invente dados.
- Nunca finja ter executado uma ação sem chamar a ferramenta correspondente.`;

// ---------------------------------------------------------------------------
// Ferramentas

const criarServicoArgs = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(5000).nullish(),
  status: z.enum(['orcamento', 'aprovado', 'em_andamento']).default('orcamento'),
  prioridade: z.enum(Prioridade).default('media'),
  empresaNome: z.string().trim().max(200).nullish(),
});

const listarServicosArgs = z.object({
  status: z.enum(['orcamento', 'aprovado', 'em_andamento', 'feito', 'rejeitado']).nullish(),
});

const criarLembreteArgs = z.object({
  mensagem: z.string().trim().min(1).max(1000),
  // Data (YYYY-MM-DD) para agendar; null/ausente = vale desde já.
  agendadoPara: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida (use YYYY-MM-DD)')
    .nullish(),
});

const salvarContextoArgs = z.object({
  texto: z.string().trim().min(1).max(2000),
});

const buscarEstoqueArgs = z.object({
  nome: z.string().trim().min(1).max(200),
});

const movimentarEstoqueArgs = z.object({
  itemId: z.string().min(1),
  quantidade: z.number().int().positive(),
  tipo: z.enum(['adicionar', 'retirar']),
});

const TOOL_DEFS = [
  {
    type: 'function' as const,
    function: {
      name: 'listar_servicos',
      description:
        'Lista os serviços do condomínio (título, status, prioridade, empresa). Filtre por status se fizer sentido.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: ['string', 'null'],
            enum: ['orcamento', 'aprovado', 'em_andamento', 'feito', 'rejeitado', null],
            description: 'Filtrar por status; null para todos.',
          },
        },
        required: ['status'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'criar_servico',
      description:
        'Cria um serviço no sistema. Use status "em_andamento" quando o problema já está sendo resolvido, "orcamento" para problema novo.',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título curto, ex.: "Vazamento no S2"' },
          descricao: {
            type: ['string', 'null'],
            description: 'Detalhes relatados (quem está resolvendo, onde, desde quando).',
          },
          status: { type: 'string', enum: ['orcamento', 'aprovado', 'em_andamento'] },
          prioridade: { type: 'string', enum: ['baixa', 'media', 'alta', 'urgente'] },
          empresaNome: {
            type: ['string', 'null'],
            description: 'Nome da empresa responsável, se citada (não precisa estar cadastrada).',
          },
        },
        required: ['titulo', 'descricao', 'status', 'prioridade', 'empresaNome'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'criar_lembrete',
      description: 'Cria um lembrete avulso para o administrador na área de lembretes.',
      parameters: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', description: 'Texto do lembrete.' },
          agendadoPara: {
            type: ['string', 'null'],
            description:
              'Data (YYYY-MM-DD) para o lembrete só aparecer no painel a partir dela; null para valer desde já. Calcule a data absoluta a partir da data atual informada no sistema (ex.: "sexta que vem", "dia 20").',
          },
        },
        required: ['mensagem', 'agendadoPara'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'salvar_contexto',
      description:
        'Salva um aviso/informação da administração (evento, obra, regra). Alimenta as respostas automáticas do WhatsApp aos moradores.',
      parameters: {
        type: 'object',
        properties: {
          texto: { type: 'string', description: 'A informação completa, com data/hora se houver.' },
        },
        required: ['texto'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_estoque',
      description: 'Busca itens de estoque pelo nome e retorna id, quantidade e unidade.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome (ou parte) do item.' },
        },
        required: ['nome'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'movimentar_estoque',
      description:
        'Adiciona ou retira unidades de um item de estoque. Use buscar_estoque antes para obter o itemId.',
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string' },
          quantidade: { type: 'integer', minimum: 1 },
          tipo: { type: 'string', enum: ['adicionar', 'retirar'] },
        },
        required: ['itemId', 'quantidade', 'tipo'],
        additionalProperties: false,
      },
    },
  },
];

async function executarFerramenta(nome: string, argsJson: string): Promise<string> {
  try {
    const args: unknown = JSON.parse(argsJson);

    switch (nome) {
      case 'listar_servicos': {
        const { status } = listarServicosArgs.parse(args);
        const servicos = await prisma.servico.findMany({
          where: status ? { status } : undefined,
          select: {
            id: true,
            titulo: true,
            status: true,
            prioridade: true,
            empresaNome: true,
            empresa: { select: { nome: true } },
            statusChangedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 30,
        });
        return JSON.stringify(
          servicos.map((s) => ({
            titulo: s.titulo,
            status: s.status,
            prioridade: s.prioridade,
            empresa: s.empresa?.nome ?? s.empresaNome ?? null,
            desde: s.statusChangedAt.toISOString(),
          })),
        );
      }

      case 'criar_servico': {
        const dados = criarServicoArgs.parse(args);
        const servico = await prisma.$transaction(async (tx) => {
          const criado = await tx.servico.create({
            data: {
              titulo: dados.titulo,
              descricao: dados.descricao ?? null,
              status: dados.status,
              prioridade: dados.prioridade,
              empresaNome: dados.empresaNome ?? null,
            },
          });
          await tx.servicoStatusLog.create({
            data: { servicoId: criado.id, deStatus: null, paraStatus: criado.status },
          });
          return criado;
        });
        return JSON.stringify({ ok: true, id: servico.id, titulo: servico.titulo, status: servico.status });
      }

      case 'criar_lembrete': {
        const { mensagem, agendadoPara } = criarLembreteArgs.parse(args);
        const lembrete = await prisma.lembrete.create({
          data: {
            mensagem,
            // Início do dia no horário de Brasília (UTC-3), igual ao formulário.
            agendadoPara: agendadoPara ? new Date(`${agendadoPara}T00:00:00-03:00`) : null,
          },
        });
        return JSON.stringify({ ok: true, id: lembrete.id, agendadoPara: agendadoPara ?? null });
      }

      case 'salvar_contexto': {
        const { texto } = salvarContextoArgs.parse(args);
        const nota = await prisma.notaContexto.create({ data: { texto } });
        return JSON.stringify({ ok: true, id: nota.id });
      }

      case 'buscar_estoque': {
        const { nome } = buscarEstoqueArgs.parse(args);
        const itens = await prisma.itemEstoque.findMany({
          where: { nome: { contains: nome, mode: 'insensitive' } },
          select: { id: true, nome: true, quantidade: true, unidade: true },
          take: 10,
        });
        return JSON.stringify(itens);
      }

      case 'movimentar_estoque': {
        const { itemId, quantidade, tipo } = movimentarEstoqueArgs.parse(args);
        if (tipo === 'adicionar') {
          const r = await prisma.itemEstoque.updateMany({
            where: { id: itemId },
            data: { quantidade: { increment: quantidade } },
          });
          if (r.count === 0) return JSON.stringify({ ok: false, erro: 'item não encontrado' });
        } else {
          const r = await prisma.itemEstoque.updateMany({
            where: { id: itemId, quantidade: { gte: quantidade } },
            data: { quantidade: { decrement: quantidade } },
          });
          if (r.count === 0) {
            return JSON.stringify({ ok: false, erro: 'estoque insuficiente ou item não encontrado' });
          }
        }
        const item = await prisma.itemEstoque.findUnique({
          where: { id: itemId },
          select: { nome: true, quantidade: true, unidade: true },
        });
        return JSON.stringify({ ok: true, item });
      }

      default:
        return JSON.stringify({ ok: false, erro: `ferramenta desconhecida: ${nome}` });
    }
  } catch (error) {
    console.error(`[assistente] falha na ferramenta ${nome}:`, error);
    return JSON.stringify({
      ok: false,
      erro: error instanceof Error ? error.message : 'erro inesperado',
    });
  }
}

// ---------------------------------------------------------------------------
// Loop de conversa

type OpenAIMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

const MAX_RODADAS_FERRAMENTAS = 5;

export async function conversarComAssistente(
  historico: ChatTurno[],
): Promise<{ resposta: string } | { erro: string }> {
  if (!env.OPENAI_API_KEY) {
    return { erro: 'OPENAI_API_KEY não configurada — o assistente está desativado.' };
  }

  const contexto = await montarContextoSistema().catch(() => null);
  const agora = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  const system = [
    SYSTEM_PROMPT,
    `Agora é ${agora} (horário de Brasília).`,
    contexto ? `Situação atual do sistema:\n\n${contexto}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const mensagens: OpenAIMessage[] = [{ role: 'system', content: system }, ...historico];

  for (let rodada = 0; rodada <= MAX_RODADAS_FERRAMENTAS; rodada++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: mensagens,
        tools: TOOL_DEFS,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error(`[assistente] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { erro: 'Falha ao falar com a IA. Tente novamente.' };
    }

    const corpo = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    };
    const mensagem = corpo.choices?.[0]?.message;
    if (!mensagem) return { erro: 'Resposta vazia da IA. Tente novamente.' };

    const toolCalls = mensagem.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { resposta: mensagem.content?.trim() || 'Feito.' };
    }

    mensagens.push({
      role: 'assistant',
      content: mensagem.content ?? null,
      tool_calls: toolCalls,
    });
    for (const call of toolCalls) {
      const resultado = await executarFerramenta(call.function.name, call.function.arguments);
      mensagens.push({ role: 'tool', tool_call_id: call.id, content: resultado });
    }
  }

  return { erro: 'A conversa exigiu ações demais de uma vez. Divida em mensagens menores.' };
}
