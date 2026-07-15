import type { Prioridade, ServicoStatus } from '@/generated/prisma/enums';
import { STATUS_LABEL, PRIORIDADE_LABEL, STATUS_ORDEM } from '@/lib/format';

// Funções puras do relatório semanal — sem Prisma, sem I/O — para o cálculo
// de período e a montagem do resumo serem testáveis isoladamente.

// Brasil não tem mais horário de verão: BRT é UTC-3 fixo.
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

export type Periodo = { inicio: Date; fim: Date };

/**
 * Semana corrente no fuso de São Paulo: segunda 00:00 BRT (inclusive)
 * até a segunda seguinte 00:00 BRT (exclusive). Determinística para
 * qualquer instante dentro da mesma semana — é isso que torna o cron
 * idempotente (mesmo período ⇒ mesmo registro).
 */
export function semanaAtualBRT(agora: Date = new Date()): Periodo {
  const deslocado = new Date(agora.getTime() - BRT_OFFSET_MS);
  const diasDesdeSegunda = (deslocado.getUTCDay() + 6) % 7;
  const segundaBRT = Date.UTC(
    deslocado.getUTCFullYear(),
    deslocado.getUTCMonth(),
    deslocado.getUTCDate() - diasDesdeSegunda,
  );
  const inicio = new Date(segundaBRT + BRT_OFFSET_MS);
  return { inicio, fim: new Date(inicio.getTime() + 7 * DIA_MS) };
}

export type RelatorioDados = {
  porStatus: Record<ServicoStatus, number>;
  prioridadesPendentes: {
    id: string;
    titulo: string;
    prioridade: Prioridade;
    status: ServicoStatus;
  }[];
  // servicoTitulo null = lembrete avulso (sem serviço vinculado)
  lembretesAtivos: { servicoTitulo: string | null; mensagem: string; criadoEm: string }[];
  estoqueAbaixoMinimo: {
    nome: string;
    quantidade: number;
    quantidadeMinima: number;
    unidade: string;
  }[];
  mudancasNaSemana: {
    servicoTitulo: string;
    de: ServicoStatus | null;
    para: ServicoStatus;
    em: string;
  }[];
  // Resumo executivo + insights gerados por IA a partir dos dados acima.
  // Opcional: null/ausente quando a IA está indisponível (ou em relatórios
  // antigos, gerados antes deste recurso).
  resumoIA?: string | null;
};

function dataCurtaBRT(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

export function montarResumoMarkdown(dados: RelatorioDados, periodo: Periodo): string {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
  // fim é exclusivo (segunda 00:00); exibe até domingo
  const fimExibicao = new Date(periodo.fim.getTime() - DIA_MS);
  const linhas: string[] = [];

  linhas.push(`# Relatório semanal do condomínio`);
  linhas.push(`Período: ${fmt.format(periodo.inicio)} a ${fmt.format(fimExibicao)}`);
  linhas.push('');

  linhas.push('## Serviços por status');
  for (const status of STATUS_ORDEM) {
    linhas.push(`- ${STATUS_LABEL[status]}: ${dados.porStatus[status] ?? 0}`);
  }
  linhas.push('');

  linhas.push('## Prioridades pendentes (alta/urgente)');
  if (dados.prioridadesPendentes.length === 0) {
    linhas.push('Nenhum serviço de prioridade alta ou urgente pendente.');
  } else {
    for (const s of dados.prioridadesPendentes) {
      linhas.push(
        `- **${s.titulo}** — ${PRIORIDADE_LABEL[s.prioridade]}, ${STATUS_LABEL[s.status]}`,
      );
    }
  }
  linhas.push('');

  linhas.push('## Lembretes ativos');
  if (dados.lembretesAtivos.length === 0) {
    linhas.push('Nenhum lembrete ativo.');
  } else {
    for (const l of dados.lembretesAtivos) {
      linhas.push(`- ${l.mensagem} (desde ${dataCurtaBRT(l.criadoEm)})`);
    }
  }
  linhas.push('');

  linhas.push('## Estoque abaixo do mínimo');
  if (dados.estoqueAbaixoMinimo.length === 0) {
    linhas.push('Nenhum item abaixo do mínimo.');
  } else {
    for (const i of dados.estoqueAbaixoMinimo) {
      linhas.push(
        `- **${i.nome}**: ${i.quantidade} ${i.unidade} (mínimo ${i.quantidadeMinima})`,
      );
    }
  }
  linhas.push('');

  linhas.push('## Movimentações da semana');
  if (dados.mudancasNaSemana.length === 0) {
    linhas.push('Nenhuma mudança de status nesta semana.');
  } else {
    for (const m of dados.mudancasNaSemana) {
      const de = m.de ? `${STATUS_LABEL[m.de]} → ` : 'criado como ';
      linhas.push(
        `- ${dataCurtaBRT(m.em)}: **${m.servicoTitulo}** — ${de}${STATUS_LABEL[m.para]}`,
      );
    }
  }

  return linhas.join('\n');
}
