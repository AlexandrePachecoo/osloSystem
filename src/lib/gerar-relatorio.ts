import { prisma } from '@/lib/prisma';
import {
  montarResumoMarkdown,
  semanaAtualBRT,
  type RelatorioDados,
} from '@/domain/relatorio';
import { STATUS_TERMINAIS } from '@/domain/servico-status';
import { gerarResumoRelatorioIA } from '@/lib/openai';
import type { Prioridade, ServicoStatus } from '@/generated/prisma/enums';

// Gera (ou regenera) o relatório da semana corrente. Usada pelo cron semanal
// e pela geração sob demanda no painel. Idempotente: o período é
// determinístico e há unique(periodoInicio, periodoFim) — reexecutar
// atualiza o mesmo registro em vez de duplicar.
export async function gerarRelatorioSemanal(agora: Date = new Date()) {
  const periodo = semanaAtualBRT(agora);

  const [
    grupos,
    pendentes,
    lembretes,
    estoque,
    logs,
    ocorrenciasPortaria,
    entreguesSemana,
    pendentesPortaria,
    relatoriosPortaria,
    mensagens,
  ] = await Promise.all([
    prisma.servico.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.servico.findMany({
      where: {
        prioridade: { in: ['alta', 'urgente'] },
        status: { notIn: [...STATUS_TERMINAIS] },
      },
      select: { id: true, titulo: true, prioridade: true, status: true },
      orderBy: [{ prioridade: 'desc' }, { updatedAt: 'asc' }],
    }),
    prisma.lembrete.findMany({
      // Adiados (adiadoAte no futuro) não entram como ativos no relatório.
      where: {
        resolvido: false,
        OR: [{ adiadoAte: null }, { adiadoAte: { lte: agora } }],
      },
      include: { servico: { select: { titulo: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.itemEstoque.findMany({ orderBy: { nome: 'asc' } }),
    prisma.servicoStatusLog.findMany({
      where: { createdAt: { gte: periodo.inicio, lt: periodo.fim } },
      include: { servico: { select: { titulo: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    // Portaria: ocorrências registradas na semana.
    prisma.ocorrenciaPortaria.findMany({
      where: { createdAt: { gte: periodo.inicio, lt: periodo.fim } },
      select: { colaborador: true, texto: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    // Encomendas efetivamente entregues na semana.
    prisma.encomendaPortaria.count({
      where: { entregue: true, entregueEm: { gte: periodo.inicio, lt: periodo.fim } },
    }),
    // Encomendas ainda aguardando retirada (de qualquer data — carregam adiante).
    prisma.encomendaPortaria.count({ where: { entregue: false } }),
    // Relatórios da portaria enviados à administração na semana.
    prisma.relatorioPortaria.count({
      where: { enviadoEm: { gte: periodo.inicio, lt: periodo.fim } },
    }),
    // Mensagens do grupo de WhatsApp recebidas na semana.
    prisma.mensagemWhatsApp.findMany({
      where: { recebidaEm: { gte: periodo.inicio, lt: periodo.fim } },
      select: { autor: true, textoOriginal: true, prioridade: true, recebidaEm: true },
      orderBy: { recebidaEm: 'asc' },
    }),
  ]);

  const porStatus = Object.fromEntries(
    grupos.map((g) => [g.status, g._count._all]),
  ) as Record<ServicoStatus, number>;

  const dados: RelatorioDados = {
    porStatus,
    prioridadesPendentes: pendentes,
    lembretesAtivos: lembretes.map((l) => ({
      servicoTitulo: l.servico?.titulo ?? null,
      mensagem: l.mensagem,
      criadoEm: l.createdAt.toISOString(),
    })),
    // volume baixo: comparação quantidade < mínima feita em memória
    // (Prisma não compara colunas entre si num where simples)
    estoqueAbaixoMinimo: estoque
      .filter((i) => i.quantidade < i.quantidadeMinima)
      .map((i) => ({
        nome: i.nome,
        quantidade: i.quantidade,
        quantidadeMinima: i.quantidadeMinima,
        unidade: i.unidade,
      })),
    mudancasNaSemana: logs.map((log) => ({
      servicoTitulo: log.servico.titulo,
      de: log.deStatus,
      para: log.paraStatus,
      em: log.createdAt.toISOString(),
    })),
    portaria: {
      ocorrencias: ocorrenciasPortaria.map((o) => ({
        colaborador: o.colaborador,
        texto: o.texto,
        em: o.createdAt.toISOString(),
      })),
      entregues: entreguesSemana,
      pendentes: pendentesPortaria,
      relatoriosEnviados: relatoriosPortaria,
    },
    whatsapp: {
      total: mensagens.length,
      porPrioridade: mensagens.reduce(
        (acc, m) => {
          if (m.prioridade) acc[m.prioridade] += 1;
          return acc;
        },
        { baixa: 0, media: 0, alta: 0, urgente: 0 } as Record<Prioridade, number>,
      ),
      // Destaques: mensagens de alta/urgente prioridade (as que exigem atenção).
      destaques: mensagens
        .filter((m) => m.prioridade === 'alta' || m.prioridade === 'urgente')
        .map((m) => ({
          autor: m.autor,
          prioridade: m.prioridade,
          texto: m.textoOriginal,
          em: m.recebidaEm.toISOString(),
        })),
    },
  };

  const resumo = montarResumoMarkdown(dados, periodo);

  // Resumo executivo + insights por IA a partir do relatório determinístico.
  // Falha da IA não bloqueia a geração: resumoIA fica null e a página esconde
  // o bloco. Guardado dentro de `dados` (Json) — sem migração de coluna.
  dados.resumoIA = await gerarResumoRelatorioIA(resumo);

  return prisma.relatorio.upsert({
    where: {
      periodoInicio_periodoFim: {
        periodoInicio: periodo.inicio,
        periodoFim: periodo.fim,
      },
    },
    create: {
      periodoInicio: periodo.inicio,
      periodoFim: periodo.fim,
      dados,
      resumo,
    },
    update: { dados, resumo },
  });
}
