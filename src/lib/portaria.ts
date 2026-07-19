// Relatório da portaria: consulta do relatório "aberto" (tudo que ainda não
// foi enviado à administração) e montagem do snapshot/resumo do envio.
//
// Regra central: encomendas NÃO entregues nunca são fechadas em um relatório —
// entram no snapshot como pendentes e continuam aparecendo nos relatórios
// seguintes até a baixa da entrega.

import { prisma } from '@/lib/prisma';
import type {
  EncomendaPortaria,
  JornalAptoPortaria,
  JornalPortaria,
  OcorrenciaPortaria,
} from '@/generated/prisma/client';
import type { EncomendaTipo } from '@/generated/prisma/enums';
import { formatarData } from '@/lib/format';

// Jornal com sua lista fixa de apartamentos (marcações de entrega inclusas).
export type JornalComAptos = JornalPortaria & { aptos: JornalAptoPortaria[] };

export type RelatorioPortariaAberto = {
  ocorrencias: OcorrenciaPortaria[];
  // ainda não entregues — de qualquer data (carregam de relatórios anteriores)
  pendentes: EncomendaPortaria[];
  // entregues desde o último envio
  entregues: EncomendaPortaria[];
  // jornais + apartamentos assinantes (com marcação de entrega do dia)
  jornais: JornalComAptos[];
};

export async function carregarRelatorioAberto(): Promise<RelatorioPortariaAberto> {
  const [ocorrencias, pendentes, entregues, jornais] = await Promise.all([
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
    prisma.jornalPortaria.findMany({
      orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
      include: { aptos: { orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }] } },
    }),
  ]);
  return { ocorrencias, pendentes, entregues, jornais };
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

// Snapshot dos jornais entregues no momento do envio (só apartamentos marcados).
export type JornalSnapshot = {
  nome: string;
  torre: string | null;
  aptosEntregues: string[];
};

export type DadosRelatorioPortaria = {
  ocorrencias: { colaborador: string; texto: string; registradaEm: string }[];
  entregues: EncomendaSnapshot[];
  pendentes: EncomendaSnapshot[];
  // opcional: relatórios antigos (antes da Fase 9) não têm este campo
  jornais?: JornalSnapshot[];
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

// Só entram no snapshot os jornais com ao menos um apartamento marcado
// (entregue) — é o "Jornais entregues" do relatório antigo.
function jornaisSnapshot(jornais: JornalComAptos[]): JornalSnapshot[] {
  return jornais
    .map((j) => ({
      nome: j.nome,
      torre: j.torre,
      aptosEntregues: j.aptos.filter((a) => a.entregue).map((a) => a.apto),
    }))
    .filter((j) => j.aptosEntregues.length > 0);
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
    jornais: jornaisSnapshot(aberto.jornais),
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

  const jornais = dados.jornais ?? [];
  linhas.push('', 'Jornais entregues:');
  if (jornais.length === 0) {
    linhas.push('- Nenhum jornal entregue no período.');
  } else {
    for (const [torre, doTorre] of agruparJornaisPorTorre(jornais)) {
      if (torre) linhas.push(`Torre ${torre}:`);
      for (const j of doTorre) {
        linhas.push(`- ${j.nome}: ${j.aptosEntregues.join(', ')}`);
      }
    }
  }

  return linhas.join('\n');
}

// Agrupa os jornais por torre preservando a ordem de entrada. Jornais sem
// torre entram sob a chave vazia (renderizada sem cabeçalho de torre).
export function agruparJornaisPorTorre(
  jornais: JornalSnapshot[],
): [string, JornalSnapshot[]][] {
  const grupos = new Map<string, JornalSnapshot[]>();
  for (const j of jornais) {
    const chave = j.torre ?? '';
    const atual = grupos.get(chave);
    if (atual) atual.push(j);
    else grupos.set(chave, [j]);
  }
  return [...grupos.entries()];
}
