import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { STATUS_LABEL, STATUS_ORDEM, formatarData } from '@/lib/format';
import { AssistenteChat } from '@/components/assistente-chat';
import { EstoqueRapido } from '@/components/estoque-rapido';
import { ContextoIA } from '@/components/contexto-ia';
import { adiarLembrete, resolverLembrete } from '@/actions/lembretes';
import type { ServicoStatus } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';
// O assistente pode encadear várias chamadas à OpenAI numa mensagem.
export const maxDuration = 60;

export default async function DashboardPage() {
  const [porStatus, lembretes, itensEstoque, notas] = await Promise.all([
    prisma.servico.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lembrete.findMany({
      // Adiados (adiadoAte no futuro) e agendados para o futuro (agendadoPara)
      // somem até a data chegar.
      where: {
        resolvido: false,
        AND: [
          { OR: [{ adiadoAte: null }, { adiadoAte: { lte: new Date() } }] },
          { OR: [{ agendadoPara: null }, { agendadoPara: { lte: new Date() } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { servico: { select: { id: true, titulo: true } } },
    }),
    prisma.itemEstoque.findMany({
      select: {
        id: true,
        nome: true,
        quantidade: true,
        quantidadeMinima: true,
        unidade: true,
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.notaContexto.findMany({
      where: { ativo: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const estoqueAbaixoMinimo = itensEstoque.filter(
    (i) => i.quantidade < i.quantidadeMinima,
  ).length;

  const contagem = new Map<ServicoStatus, number>(
    porStatus.map((g) => [g.status, g._count._all]),
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Painel</h1>

      {estoqueAbaixoMinimo > 0 && (
        <Link
          href="/estoque"
          className="block rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 hover:border-red-300"
        >
          {estoqueAbaixoMinimo === 1
            ? '1 item de estoque está abaixo do mínimo.'
            : `${estoqueAbaixoMinimo} itens de estoque estão abaixo do mínimo.`}{' '}
          Ver estoque →
        </Link>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUS_ORDEM.map((status) => (
          <Link
            key={status}
            href={`/servicos?status=${status}`}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
          >
            <div className="text-2xl font-semibold">{contagem.get(status) ?? 0}</div>
            <div className="mt-1 text-sm text-slate-500">{STATUS_LABEL[status]}</div>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <AssistenteChat disponivel={Boolean(env.OPENAI_API_KEY)} />

        <div className="space-y-6">
          <EstoqueRapido itens={itensEstoque} />

          <ContextoIA
            notas={notas.map((n) => ({
              id: n.id,
              texto: n.texto,
              data: formatarData(n.createdAt),
            }))}
          />
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Lembretes ativos</h2>
          <Link href="/lembretes" className="text-sm text-blue-600 hover:underline">
            ver todos
          </Link>
        </div>
        {lembretes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum lembrete ativo.</p>
        ) : (
          <ul className="space-y-2">
            {lembretes.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
              >
                <div className="min-w-0">
                  {l.servico ? (
                    <Link href={`/servicos/${l.servico.id}`} className="hover:underline">
                      {l.mensagem}
                    </Link>
                  ) : (
                    <span>{l.mensagem}</span>
                  )}
                  <span className="ml-2 text-xs text-slate-500">{formatarData(l.createdAt)}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={adiarLembrete}>
                    <input type="hidden" name="id" value={l.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                    >
                      Adiar
                    </button>
                  </form>
                  <form action={resolverLembrete}>
                    <input type="hidden" name="id" value={l.id} />
                    <button
                      type="submit"
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      Feito
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
