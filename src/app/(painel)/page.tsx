import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { STATUS_LABEL, STATUS_ORDEM, formatarData } from '@/lib/format';
import type { ServicoStatus } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [porStatus, lembretes, itensEstoque] = await Promise.all([
    prisma.servico.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lembrete.findMany({
      where: { resolvido: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { servico: { select: { id: true, titulo: true } } },
    }),
    prisma.itemEstoque.findMany({ select: { quantidade: true, quantidadeMinima: true } }),
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
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
              >
                <Link href={`/servicos/${l.servico.id}`} className="hover:underline">
                  {l.mensagem}
                </Link>
                <span className="ml-2 text-xs text-slate-500">{formatarData(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
