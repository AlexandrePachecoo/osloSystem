import { z } from 'zod';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { montarContextoSistema } from '@/lib/contexto-ia';
import { Prioridade } from '@/generated/prisma/enums';
import { STATUS_TERMINAIS } from '@/domain/servico-status';

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
- Quando o administrador relatar um fato que corresponde a uma ação (problema sendo resolvido → criar serviço; aviso/informação para os moradores → salvar contexto; coisa a não esquecer → criar lembrete; material usado/comprado → movimentar estoque; material novo que ainda não existe no estoque → cadastrar item), execute a ação em vez de apenas responder.
- Estoque: para ajustar a quantidade de um item que já existe, use movimentar_estoque (busque o item antes). Para um material que ainda não está cadastrado, use criar_item_estoque; confira antes com buscar_estoque para não duplicar. Se o administrador não informar a unidade de medida de um item novo, pergunte.
- Um lembrete pode ser agendado para uma data futura ("me lembra de cobrar a empresa X dia 20", "semana que vem"): calcule a data absoluta (YYYY-MM-DD) a partir da data atual informada e passe em agendadoPara. Sem data explícita, deixe null (vale desde já).
- Status do serviço: se alguém JÁ está executando, consertando, mexendo, já comprou/usou material ou a obra começou → "em_andamento". Se ainda é só um problema a levantar orçamento, sem ninguém contratado trabalhando → "orcamento". Use "aprovado" quando um orçamento já foi escolhido mas o trabalho ainda não começou. Na dúvida entre orçamento e andamento, havendo alguém já trabalhando, escolha "em_andamento". Ex.: "o Paulo está resolvendo o vazamento no S1" → serviço "em_andamento".
- Valor/custo/orçamento em reais (ex.: "ficou em 2 mil", "R$ 2.000", "custou 2000"): passe SÓ o número em valorOrcamento ao criar o serviço. Nunca escreva o valor apenas na descrição — o campo próprio é valorOrcamento.
- Para excluir um serviço, use listar_servicos antes para descobrir o servicoId e então chame excluir_servico. Só dá para excluir serviços em orçamento ou já encerrados (feito/rejeitado); se o serviço estiver aprovado ou em andamento, explique que é preciso mudar o status antes.
- Avisos e informações gerais (eventos, obras, mudanças de regra) devem ser salvos como contexto: eles alimentam as respostas automáticas do WhatsApp aos moradores.
- Depois de executar uma ação, confirme em uma frase o que foi feito.
- Se faltar informação essencial (ex.: título do serviço impossível de deduzir), pergunte antes de agir. Não invente dados.
- Nunca finja ter executado uma ação sem chamar a ferramenta correspondente.`;

// ---------------------------------------------------------------------------
// Ferramentas

const criarServicoArgs = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(5000).nullish(),
  // Valor estimado/orçado do serviço, em reais. Vai no campo próprio, nunca na descrição.
  valorOrcamento: z.number().nonnegative().nullish(),
  status: z.enum(['orcamento', 'aprovado', 'em_andamento']).default('orcamento'),
  prioridade: z.enum(Prioridade).default('media'),
  empresaNome: z.string().trim().max(200).nullish(),
});

const listarServicosArgs = z.object({
  status: z.enum(['orcamento', 'aprovado', 'em_andamento', 'feito', 'rejeitado']).nullish(),
});

const excluirServicoArgs = z.object({
  servicoId: z.string().min(1),
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

const criarItemEstoqueArgs = z.object({
  nome: z.string().trim().min(1).max(200),
  unidade: z.string().trim().min(1).max(20),
  quantidade: z.number().int().min(0).default(0),
  quantidadeMinima: z.number().int().min(0).default(0),
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
        'Cria um serviço no sistema. Use status "em_andamento" quando alguém já está executando/consertando o problema (ainda que só tenha comprado material ou começado), "orcamento" para um problema novo ainda sem ninguém contratado. Se houver valor em reais, use valorOrcamento — não jogue o valor na descrição.',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título curto, ex.: "Vazamento no S2"' },
          descricao: {
            type: ['string', 'null'],
            description:
              'Detalhes relatados (quem está resolvendo, onde, desde quando). NÃO inclua o valor aqui — use valorOrcamento.',
          },
          valorOrcamento: {
            type: ['number', 'null'],
            description:
              'Valor do orçamento em reais, só o número (ex.: 2000 para "R$ 2.000" ou "2 mil"). null se não houver valor citado.',
          },
          status: { type: 'string', enum: ['orcamento', 'aprovado', 'em_andamento'] },
          prioridade: { type: 'string', enum: ['baixa', 'media', 'alta', 'urgente'] },
          empresaNome: {
            type: ['string', 'null'],
            description: 'Nome da empresa/pessoa responsável, se citada (não precisa estar cadastrada).',
          },
        },
        required: ['titulo', 'descricao', 'valorOrcamento', 'status', 'prioridade', 'empresaNome'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'excluir_servico',
      description:
        'Exclui um serviço do sistema. Use listar_servicos antes para obter o servicoId. Só é possível excluir serviços em orçamento ou já encerrados (feito/rejeitado); serviços aprovados ou em andamento não podem ser excluídos.',
      parameters: {
        type: 'object',
        properties: {
          servicoId: { type: 'string', description: 'ID do serviço, obtido em listar_servicos.' },
        },
        required: ['servicoId'],
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
        'Adiciona ou retira unidades de um item de estoque JÁ existente. Use buscar_estoque antes para obter o itemId. Para cadastrar um item novo, use criar_item_estoque.',
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
  {
    type: 'function' as const,
    function: {
      name: 'criar_item_estoque',
      description:
        'Cadastra um item NOVO no estoque (que ainda não existe). Antes de criar, use buscar_estoque para confirmar que o item não está cadastrado — se já existir, use movimentar_estoque em vez de criar duplicado.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome do item, ex.: "Lâmpada LED 9W".' },
          unidade: {
            type: 'string',
            description: 'Unidade de medida, ex.: "un", "litro", "kg", "pct".',
          },
          quantidade: {
            type: 'integer',
            minimum: 0,
            description: 'Quantidade inicial em estoque. Use 0 se não informada.',
          },
          quantidadeMinima: {
            type: 'integer',
            minimum: 0,
            description: 'Estoque mínimo para alerta de reposição. Use 0 se não informada.',
          },
        },
        required: ['nome', 'unidade', 'quantidade', 'quantidadeMinima'],
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
            id: s.id,
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
              valorOrcamento: dados.valorOrcamento ?? null,
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
        return JSON.stringify({
          ok: true,
          id: servico.id,
          titulo: servico.titulo,
          status: servico.status,
          valorOrcamento: servico.valorOrcamento ? Number(servico.valorOrcamento) : null,
        });
      }

      case 'excluir_servico': {
        const { servicoId } = excluirServicoArgs.parse(args);
        const servico = await prisma.servico.findUnique({
          where: { id: servicoId },
          select: { status: true, titulo: true },
        });
        if (!servico) return JSON.stringify({ ok: false, erro: 'serviço não encontrado' });
        // Mesma regra do painel: preserva o histórico dos serviços que estão
        // no meio do fluxo (aprovado/em_andamento).
        const podeExcluir =
          STATUS_TERMINAIS.includes(servico.status) || servico.status === 'orcamento';
        if (!podeExcluir) {
          return JSON.stringify({
            ok: false,
            erro: `serviço "${servico.titulo}" está com status "${servico.status}" e não pode ser excluído — só orçamento ou encerrados (feito/rejeitado). Mude o status antes.`,
          });
        }
        await prisma.servico.delete({ where: { id: servicoId } });
        return JSON.stringify({ ok: true, excluido: servico.titulo });
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
        // Quebra a busca em palavras: caixa, ordem e palavras extras no cadastro
        // não devem atrapalhar. "caneta vermelha" acha "Caneta Esferográfica
        // Vermelha" e também "CANETA VERMELHA".
        const termos = nome.split(/\s+/).filter(Boolean);
        const select = { id: true, nome: true, quantidade: true, unidade: true } as const;

        // Primeiro tenta itens que contenham TODAS as palavras (mais preciso).
        let itens = await prisma.itemEstoque.findMany({
          where: {
            AND: termos.map((t) => ({ nome: { contains: t, mode: 'insensitive' as const } })),
          },
          select,
          take: 10,
        });

        // Se nada casou com todas juntas, afrouxa para QUALQUER palavra, para
        // não deixar o item passar batido por uma palavra a mais ou a menos.
        if (itens.length === 0 && termos.length > 1) {
          itens = await prisma.itemEstoque.findMany({
            where: {
              OR: termos.map((t) => ({ nome: { contains: t, mode: 'insensitive' as const } })),
            },
            select,
            take: 10,
          });
        }
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

      case 'criar_item_estoque': {
        const dados = criarItemEstoqueArgs.parse(args);
        // Evita duplicar um item já cadastrado com o mesmo nome.
        const existente = await prisma.itemEstoque.findFirst({
          where: { nome: { equals: dados.nome, mode: 'insensitive' } },
          select: { id: true, nome: true, quantidade: true, unidade: true },
        });
        if (existente) {
          return JSON.stringify({
            ok: false,
            erro: 'item já cadastrado; use movimentar_estoque para ajustar a quantidade',
            item: existente,
          });
        }
        const criado = await prisma.itemEstoque.create({
          data: {
            nome: dados.nome,
            unidade: dados.unidade,
            quantidade: dados.quantidade,
            quantidadeMinima: dados.quantidadeMinima,
          },
          select: { id: true, nome: true, quantidade: true, unidade: true },
        });
        return JSON.stringify({ ok: true, item: criado });
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
