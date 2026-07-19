// Download do relatório da portaria em PDF.
// - GET /api/portaria/relatorio/pdf        → relatório ATUAL (ainda não enviado)
// - GET /api/portaria/relatorio/pdf?id=... → relatório já enviado (snapshot)
// O proxy já exige sessão para /api/portaria/*, mas o papel é revalidado aqui
// (mesma defesa em profundidade das Server Actions).

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { SESSION_COOKIE, getPapelFromToken } from '@/lib/session';
import {
  carregarRelatorioAberto,
  montarDados,
  type DadosRelatorioPortaria,
} from '@/lib/portaria';
import { gerarPdfRelatorioPortaria } from '@/lib/pdf-portaria';
import { formatarData } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Normaliza o nome do colaborador para uso em nome de arquivo: sem acentos,
// espaços viram hífen e só ASCII seguro sobra (evita header quebrado / download
// com nome estranho). Vazio quando não há colaborador (relatório em aberto).
function fatiaNome(colaborador: string): string {
  const slug = colaborador
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug ? `-${slug}` : '';
}

function nomeArquivo(data: Date, colaborador: string): string {
  const dia = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(data); // YYYY-MM-DD
  return `relatorio-portaria${fatiaNome(colaborador)}-${dia}.pdf`;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const papel = await getPapelFromToken(token, env.AUTH_SECRET);
  if (!papel) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');

  let dados: DadosRelatorioPortaria;
  let subtitulo: string;
  let referencia: Date;
  let colaborador = '';

  if (id) {
    const relatorio = await prisma.relatorioPortaria.findUnique({ where: { id } });
    if (!relatorio) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 });
    }
    dados = relatorio.dados as DadosRelatorioPortaria;
    referencia = relatorio.enviadoEm;
    colaborador = relatorio.colaborador;
    subtitulo = `Enviado por ${relatorio.colaborador} em ${formatarData(relatorio.enviadoEm)}`;
  } else {
    dados = montarDados(await carregarRelatorioAberto());
    referencia = new Date();
    subtitulo = `Relatório em aberto — gerado em ${formatarData(referencia)}`;
  }

  const pdf = await gerarPdfRelatorioPortaria({ subtitulo, dados });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivo(referencia, colaborador)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
