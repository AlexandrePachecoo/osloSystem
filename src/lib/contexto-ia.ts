import { prisma } from '@/lib/prisma';
import { STATUS_LABEL, PRIORIDADE_LABEL, formatarData } from '@/lib/format';

// Monta o retrato atual do sistema para alimentar a IA (respostas do
// WhatsApp e assistente do painel): serviços não terminados + notas de
// contexto ativas (avisos que o admin cadastrou, ex.: festa no salão).
export async function montarContextoSistema(): Promise<string> {
  const [servicos, notas] = await Promise.all([
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

  return [
    'Serviços do condomínio em aberto (orçamento/aprovado/em andamento):',
    linhasServicos.length > 0 ? linhasServicos.join('\n') : '(nenhum serviço em aberto)',
    '',
    'Avisos e informações registradas pela administração:',
    linhasNotas.length > 0 ? linhasNotas.join('\n') : '(nenhum aviso registrado)',
  ].join('\n');
}
