'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { exigirSessao } from '@/lib/session-server';
import { melhorarTextoOcorrencia } from '@/lib/openai';
import {
  ocorrenciaCreateSchema,
  encomendaCreateSchema,
  enviarRelatorioSchema,
  jornalCreateSchema,
} from '@/schemas/portaria';
import {
  carregarRelatorioAberto,
  montarDados,
  montarResumo,
} from '@/lib/portaria';
import type { ActionState } from '@/actions/servicos';

// Todas as actions daqui aceitam admin E funcionário (exigirSessao) — a
// portaria é a única área compartilhada pelos dois papéis.

export async function registrarOcorrencia(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirSessao();
  const parsed = ocorrenciaCreateSchema.safeParse({
    colaborador: formData.get('colaborador'),
    texto: formData.get('texto'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.ocorrenciaPortaria.create({ data: parsed.data });
  revalidatePath('/portaria');
  return { error: null };
}

// Só ocorrências ainda não enviadas podem ser excluídas — relatório enviado
// é registro fechado.
export async function excluirOcorrencia(formData: FormData): Promise<void> {
  await exigirSessao();
  const id = z.cuid().parse(formData.get('id'));
  await prisma.ocorrenciaPortaria.deleteMany({ where: { id, relatorioId: null } });
  revalidatePath('/portaria');
}

// Reescrita do texto da ocorrência via IA. Falha da OpenAI vira mensagem
// amigável — o porteiro segue com o texto original.
export async function melhorarOcorrencia(texto: string): Promise<{
  texto: string | null;
  error: string | null;
}> {
  await exigirSessao();
  const limpo = texto.trim();
  if (!limpo) return { texto: null, error: 'Escreva a ocorrência antes de melhorar o texto' };

  const melhorado = await melhorarTextoOcorrencia(limpo.slice(0, 4000), new Date());
  if (!melhorado) {
    return {
      texto: null,
      error: 'IA indisponível no momento — o texto original continua valendo',
    };
  }
  return { texto: melhorado, error: null };
}

export async function registrarEncomenda(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirSessao();
  const parsed = encomendaCreateSchema.safeParse({
    colaborador: formData.get('colaborador'),
    apto: formData.get('apto'),
    descricao: formData.get('descricao'),
    tipo: formData.get('tipo'),
    retiradaPor: formData.get('retiradaPor') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.encomendaPortaria.create({ data: parsed.data });
  revalidatePath('/portaria');
  return { error: null };
}

// Baixa de entrega: a encomenda sai das pendentes e entra nas "entregues"
// do relatório aberto (será fechada no próximo envio).
export async function baixarEntregaEncomenda(formData: FormData): Promise<void> {
  await exigirSessao();
  const id = z.cuid().parse(formData.get('id'));
  await prisma.encomendaPortaria.updateMany({
    where: { id, entregue: false },
    data: { entregue: true, entregueEm: new Date() },
  });
  revalidatePath('/portaria');
}

// Corrige registro errado — só enquanto pendente (não entregue, não reportada).
export async function excluirEncomenda(formData: FormData): Promise<void> {
  await exigirSessao();
  const id = z.cuid().parse(formData.get('id'));
  await prisma.encomendaPortaria.deleteMany({
    where: { id, entregue: false, relatorioId: null },
  });
  revalidatePath('/portaria');
}

// --- Jornais ---
// Lista fixa de apartamentos assinantes por jornal. A portaria marca no dia
// quais foram entregues (checkbox); o envio do relatório zera as marcações.

export async function adicionarJornal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirSessao();
  const parsed = jornalCreateSchema.safeParse({
    nome: formData.get('nome'),
    torre: formData.get('torre') ?? '',
    aptos: formData.get('aptos') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { nome, torre, aptos } = parsed.data;

  const ordem = await prisma.jornalPortaria.count();
  await prisma.jornalPortaria.create({
    data: {
      nome,
      torre,
      ordem,
      aptos: {
        create: aptos.map((apto, i) => ({ apto, ordem: i })),
      },
    },
  });
  revalidatePath('/portaria');
  return { error: null };
}

// Marca/desmarca a entrega de um jornal em um apartamento (checkbox).
export async function definirEntregaJornalApto(aptoId: string, entregue: boolean): Promise<void> {
  await exigirSessao();
  const id = z.cuid().parse(aptoId);
  await prisma.jornalAptoPortaria.updateMany({
    where: { id },
    data: { entregue: Boolean(entregue) },
  });
  revalidatePath('/portaria');
}

// Marca/desmarca vários apartamentos de uma vez (botão "marcar todos").
export async function definirEntregaVariosAptos(
  aptoIds: string[],
  entregue: boolean,
): Promise<void> {
  await exigirSessao();
  const ids = z.array(z.cuid()).max(2000).parse(aptoIds);
  if (ids.length === 0) return;
  await prisma.jornalAptoPortaria.updateMany({
    where: { id: { in: ids } },
    data: { entregue: Boolean(entregue) },
  });
  revalidatePath('/portaria');
}

// Acrescenta um apartamento à lista fixa de um jornal.
export async function adicionarAptoJornal(formData: FormData): Promise<void> {
  await exigirSessao();
  const jornalId = z.cuid().parse(formData.get('jornalId'));
  const apto = z.string().trim().min(1).max(20).parse(formData.get('apto'));
  const ordem = await prisma.jornalAptoPortaria.count({ where: { jornalId } });
  await prisma.jornalAptoPortaria.create({ data: { jornalId, apto, ordem } });
  revalidatePath('/portaria');
}

export async function excluirAptoJornal(formData: FormData): Promise<void> {
  await exigirSessao();
  const id = z.cuid().parse(formData.get('id'));
  await prisma.jornalAptoPortaria.deleteMany({ where: { id } });
  revalidatePath('/portaria');
}

export async function excluirJornal(formData: FormData): Promise<void> {
  await exigirSessao();
  const id = z.cuid().parse(formData.get('id'));
  await prisma.jornalPortaria.deleteMany({ where: { id } });
  revalidatePath('/portaria');
}

// "Enviar para a administração": fecha o relatório aberto em um
// RelatorioPortaria (snapshot em `dados` + resumo em texto). Ocorrências e
// entregas baixadas são vinculadas ao relatório; pendentes ficam soltas e
// reaparecem no próximo relatório automaticamente.
export async function enviarRelatorioPortaria(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await exigirSessao();
  const parsed = enviarRelatorioSchema.safeParse({
    colaborador: formData.get('colaborador'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { colaborador } = parsed.data;

  const aberto = await carregarRelatorioAberto();
  const jornaisEntregues = aberto.jornais.some((j) => j.aptos.some((a) => a.entregue));
  if (
    aberto.ocorrencias.length === 0 &&
    aberto.entregues.length === 0 &&
    aberto.pendentes.length === 0 &&
    !jornaisEntregues
  ) {
    return { error: 'Nada para enviar: sem ocorrências, encomendas ou jornais no período' };
  }

  const dados = montarDados(aberto);
  const resumo = montarResumo(colaborador, dados);

  await prisma.$transaction(async (tx) => {
    const relatorio = await tx.relatorioPortaria.create({
      data: { colaborador, dados, resumo },
    });
    await tx.ocorrenciaPortaria.updateMany({
      where: { id: { in: aberto.ocorrencias.map((o) => o.id) } },
      data: { relatorioId: relatorio.id },
    });
    await tx.encomendaPortaria.updateMany({
      where: { id: { in: aberto.entregues.map((e) => e.id) } },
      data: { relatorioId: relatorio.id },
    });
    // Jornais são configuração fixa: só zeramos as marcações de entrega do dia.
    if (jornaisEntregues) {
      await tx.jornalAptoPortaria.updateMany({
        where: { entregue: true },
        data: { entregue: false },
      });
    }
  });

  revalidatePath('/portaria');
  revalidatePath('/relatorios');
  return { error: null };
}
