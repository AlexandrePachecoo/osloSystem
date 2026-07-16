import { prisma } from '@/lib/prisma';
import { STATUS_LABEL, PRIORIDADE_LABEL, formatarData } from '@/lib/format';

// Janela de "recente" para o contexto do assistente/WhatsApp: últimos 7 dias.
const JANELA_MS = 7 * 24 * 60 * 60 * 1000;

// Monta o retrato atual do sistema para alimentar a IA (respostas do
// WhatsApp e assistente do painel). Reúne o máximo de contexto útil:
// serviços em aberto, avisos da administração, movimento recente da portaria
// (ocorrências + encomendas aguardando retirada), estoque abaixo do mínimo e
// as últimas mensagens do WhatsApp — para a IA responder e agir sabendo o que
// está acontecendo no condomínio.
export async function montarContextoSistema(agora: Date = new Date()): Promise<string> {
  const desde = new Date(agora.getTime() - JANELA_MS);

  const [servicos, notas, ocorrencias, pendentes, estoque, mensagens] = await Promise.all([
    prisma.servico.findMany({
      where: { status: { in: ['orcamento', 'aprovado', 'em_andamento'] } },
      select: {
        titulo: true,
        descricao: true,
        status: true,
        prioridade: true,
        statusChangedAt: true,
        empresaNome: true,
        empresa: { select: { nome: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    prisma.notaContexto.findMany({
      where: { ativo: true },
      select: { texto: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    // Ocorrências da portaria dos últimos dias (enviadas ou não à administração).
    prisma.ocorrenciaPortaria.findMany({
      where: { createdAt: { gte: desde } },
      select: { colaborador: true, texto: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // Encomendas ainda não entregues — de qualquer data (carregam de dias anteriores).
    prisma.encomendaPortaria.findMany({
      where: { entregue: false },
      select: { apto: true, descricao: true, tipo: true, retiradaPor: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 30,
    }),
    // Estoque completo (volume baixo) — a comparação com o mínimo é feita em memória.
    prisma.itemEstoque.findMany({
      select: { nome: true, quantidade: true, quantidadeMinima: true, unidade: true },
      orderBy: { nome: 'asc' },
    }),
    // Últimas mensagens do grupo de WhatsApp — dá contexto de conversa à IA.
    prisma.mensagemWhatsApp.findMany({
      where: { recebidaEm: { gte: desde } },
      select: { autor: true, textoOriginal: true, prioridade: true, recebidaEm: true },
      orderBy: { recebidaEm: 'desc' },
      take: 20,
    }),
  ]);

  const linhasServicos = servicos.map((s) => {
    const empresa = s.empresa?.nome ?? s.empresaNome;
    const partes = [
      `- ${s.titulo} — ${STATUS_LABEL[s.status]}, prioridade ${PRIORIDADE_LABEL[s.prioridade]}`,
      empresa ? `empresa: ${empresa}` : null,
      s.descricao ? `detalhes: ${s.descricao}` : null,
      `desde ${formatarData(s.statusChangedAt)}`,
    ].filter(Boolean);
    return partes.join('; ');
  });

  const linhasNotas = notas.map((n) => `- [${formatarData(n.createdAt)}] ${n.texto}`);

  const linhasOcorrencias = ocorrencias.map(
    (o) => `- [${formatarData(o.createdAt)}] ${o.colaborador}: ${o.texto}`,
  );

  const linhasPendentes = pendentes.map((e) => {
    const tipo =
      e.tipo === 'externa' ? `externa — retirada por ${e.retiradaPor ?? '?'}` : 'interna';
    return `- Apto ${e.apto} — ${e.descricao} (${tipo}) — recebida em ${formatarData(e.createdAt)}`;
  });

  const estoqueBaixo = estoque.filter((i) => i.quantidade < i.quantidadeMinima);
  const linhasEstoque = estoqueBaixo.map(
    (i) => `- ${i.nome}: ${i.quantidade} ${i.unidade} (mínimo ${i.quantidadeMinima})`,
  );

  const linhasMensagens = mensagens.map((m) => {
    const prio = m.prioridade ? `[${PRIORIDADE_LABEL[m.prioridade]}] ` : '';
    return `- [${formatarData(m.recebidaEm)}] ${prio}${m.autor}: ${m.textoOriginal}`;
  });

  return [
    'Serviços do condomínio em aberto (orçamento/aprovado/em andamento):',
    linhasServicos.length > 0 ? linhasServicos.join('\n') : '(nenhum serviço em aberto)',
    '',
    'Avisos e informações registradas pela administração:',
    linhasNotas.length > 0 ? linhasNotas.join('\n') : '(nenhum aviso registrado)',
    '',
    'Portaria — ocorrências recentes (últimos 7 dias):',
    linhasOcorrencias.length > 0 ? linhasOcorrencias.join('\n') : '(nenhuma ocorrência recente)',
    '',
    'Portaria — encomendas aguardando retirada:',
    linhasPendentes.length > 0 ? linhasPendentes.join('\n') : '(nenhuma encomenda pendente)',
    '',
    'Estoque abaixo do mínimo:',
    linhasEstoque.length > 0 ? linhasEstoque.join('\n') : '(nenhum item abaixo do mínimo)',
    '',
    'WhatsApp — últimas mensagens do grupo (últimos 7 dias):',
    linhasMensagens.length > 0 ? linhasMensagens.join('\n') : '(nenhuma mensagem recente)',
  ].join('\n');
}
