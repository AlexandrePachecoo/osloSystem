import { prisma } from '@/lib/prisma';
import {
  montarResumoMarkdown,
  semanaAtualBRT,
  type RelatorioDados,
} from '@/domain/relatorio';
import { STATUS_TERMINAIS } from '@/domain/servico-status';
import { gerarResumoRelatorioIA } from '@/lib/openai';
import type { ServicoStatus } from '@/generated/prisma/enums';

// Gera (ou regenera) o relatório da semana corrente. Usada pelo cron semanal
// e pela geração sob demanda no painel. Idempotente: o período é
// determinístico e há unique(periodoInicio, periodoFim) — reexecutar
// atualiza o mesmo registro em vez de duplicar.
export async function gerarRelatorioSemanal(agora: Date = new Date()) {
  const periodo = semanaAtualBRT(agora);

  const [grupos, pendentes, lembretes, estoque, logs] = await Promise.all([
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
