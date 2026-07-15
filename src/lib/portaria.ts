// Relatório da portaria: consulta do relatório "aberto" (tudo que ainda não
// foi enviado à administração) e montagem do snapshot/resumo do envio.
//
// Regra central: encomendas NÃO entregues nunca são fechadas em um relatório —
// entram no snapshot como pendentes e continuam aparecendo nos relatórios
// seguintes até a baixa da entrega.

import { prisma } from '@/lib/prisma';
import type { EncomendaPortaria, OcorrenciaPortaria } from '@/generated/prisma/client';
import type { EncomendaTipo } from '@/generated/prisma/enums';
import { formatarData } from '@/lib/format';

export type RelatorioPortariaAberto = {
  ocorrencias: OcorrenciaPortaria[];
  // ainda não entregues — de qualquer data (carregam de relatórios anteriores)
  pendentes: EncomendaPortaria[];
  // entregues desde o último envio
  entregues: EncomendaPortaria[];
};

export async function carregarRelatorioAberto(): Promise<RelatorioPortariaAberto> {
  const [ocorrencias, pendentes, entregues] = await Promise.all([
    prisma.ocorrenciaPortaria.findMany({
      where: { relatorioId: null },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.encomendaPortaria.findMany({
      where: { entregue: false },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.encomendaPortaria.findMany({
      where: { entregue: true, relatorioId: null },
      orderBy: { entregueEm: 'asc' },
    }),
  ]);
  return { ocorrencias, pendentes, entregues };
}

// Shape do JSON gravado em RelatorioPortaria.dados — snapshot imutável do
// momento do envio (uma pendente entregue depois continua pendente AQUI).
export type EncomendaSnapshot = {
  apto: string;
  descricao: string;
  tipo: EncomendaTipo;
  retiradaPor: string | null;
  colaborador: string;
  registradaEm: string; // ISO
  entregueEm: string | null; // ISO
};

export type DadosRelatorioPortaria = {
  ocorrencias: { colaborador: string; texto: string; registradaEm: string }[];
  entregues: EncomendaSnapshot[];
  pendentes: EncomendaSnapshot[];
};

function encomendaSnapshot(e: EncomendaPortaria): EncomendaSnapshot {
  return {
    apto: e.apto,
    descricao: e.descricao,
    tipo: e.tipo,
    retiradaPor: e.retiradaPor,
    colaborador: e.colaborador,
    registradaEm: e.createdAt.toISOString(),
    entregueEm: e.entregueEm ? e.entregueEm.toISOString() : null,
  };
}

export function montarDados(aberto: RelatorioPortariaAberto): DadosRelatorioPortaria {
  return {
    ocorrencias: aberto.ocorrencias.map((o) => ({
      colaborador: o.colaborador,
      texto: o.texto,
      registradaEm: o.createdAt.toISOString(),
    })),
    entregues: aberto.entregues.map(encomendaSnapshot),
    pendentes: aberto.pendentes.map(encomendaSnapshot),
  };
}

export function descreverEncomenda(e: EncomendaSnapshot): string {
  const tipo =
    e.tipo === 'externa' ? `externa — retirada por ${e.retiradaPor ?? '?'}` : 'interna';
  const baixa = e.entregueEm ? ` — entregue em ${formatarData(new Date(e.entregueEm))}` : '';
  return `Apto ${e.apto} — ${e.descricao} (${tipo}) — recebida em ${formatarData(
    new Date(e.registradaEm),
  )}${baixa}`;
}

export function montarResumo(colaborador: string, dados: DadosRelatorioPortaria): string {
  const linhas: string[] = [`Relatório da portaria — enviado por ${colaborador}`, ''];

  linhas.push(`Ocorrências (${dados.ocorrencias.length}):`);
  if (dados.ocorrencias.length === 0) {
    linhas.push('- Sem ocorrências no período.');
  } else {
    for (const o of dados.ocorrencias) {
      linhas.push(`- [${formatarData(new Date(o.registradaEm))}] ${o.colaborador}: ${o.texto}`);
    }
  }

  linhas.push('', `Encomendas entregues (${dados.entregues.length}):`);
  if (dados.entregues.length === 0) {
    linhas.push('- Nenhuma entrega baixada no período.');
  } else {
    for (const e of dados.entregues) linhas.push(`- ${descreverEncomenda(e)}`);
  }

  linhas.push('', `Encomendas aguardando retirada (${dados.pendentes.length}):`);
  if (dados.pendentes.length === 0) {
    linhas.push('- Nenhuma encomenda pendente.');
  } else {
    for (const e of dados.pendentes) linhas.push(`- ${descreverEncomenda(e)}`);
  }

  return linhas.join('\n');
}
