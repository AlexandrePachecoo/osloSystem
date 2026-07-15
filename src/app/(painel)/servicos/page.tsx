import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PrioridadeBadge } from '@/components/badges';
import { StatusQuickChange } from '@/components/status-quick-change';
import { STATUS_LABEL, STATUS_ORDEM, formatarData, formatarMoeda } from '@/lib/format';
import { servicoStatusSchema } from '@/schemas/servico';
import type { ServicoStatus } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';

type Search = { status?: string; view?: string };

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const statusParse = servicoStatusSchema.safeParse(params.status);
  const filtro: ServicoStatus | undefined = statusParse.success ? statusParse.data : undefined;
  // Board é a visão padrão; a tabela só aparece com ?view=tabela.
  const board = params.view !== 'tabela';

  const servicos = await prisma.servico.findMany({
    where: filtro ? { status: filtro } : undefined,
    include: { empresa: { select: { nome: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  const linkFiltro = (status?: ServicoStatus) =>
    `/servicos?${new URLSearchParams({
      ...(status ? { status } : {}),
      ...(board ? {} : { view: 'tabela' }),
    })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Serviços</h1>
        <Link
          href="/servicos/novo"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Novo serviço
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm">
          <FiltroTab href={linkFiltro(undefined)} ativo={!filtro} label="Todos" />
          {STATUS_ORDEM.map((s) => (
            <FiltroTab key={s} href={linkFiltro(s)} ativo={filtro === s} label={STATUS_LABEL[s]} />
          ))}
        </nav>
        <nav className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm">
          <FiltroTab
            href={`/servicos${filtro ? `?status=${filtro}` : ''}`}
            ativo={board}
            label="Board"
          />
          <FiltroTab
            href={`/servicos?${new URLSearchParams({ ...(filtro ? { status: filtro } : {}), view: 'tabela' })}`}
            ativo={!board}
            label="Tabela"
          />
        </nav>
      </div>

      {board ? <Board servicos={servicos} /> : <Tabela servicos={servicos} />}
    </div>
  );
}

function FiltroTab({ href, ativo, label }: { href: string; ativo: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 ${
        ativo ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </Link>
  );
}

type ServicoLinha = {
  id: string;
  titulo: string;
  status: ServicoStatus;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  valorOrcamento: unknown;
  updatedAt: Date;
  empresa: { nome: string } | null;
  empresaNome: string | null;
};

function Tabela({ servicos }: { servicos: ServicoLinha[] }) {
  if (servicos.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum serviço encontrado.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Prioridade</th>
            <th className="px-4 py-3">Empresa</th>
            <th className="px-4 py-3">Orçamento</th>
            <th className="px-4 py-3">Atualizado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {servicos.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/servicos/${s.id}`} className="font-medium hover:underline">
                  {s.titulo}
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusQuickChange id={s.id} status={s.status} />
              </td>
              <td className="px-4 py-3">
                <PrioridadeBadge prioridade={s.prioridade} />
              </td>
              <td className="px-4 py-3 text-slate-600">
                {s.empresa?.nome ?? (s.empresaNome ? `${s.empresaNome} (sem cadastro)` : '—')}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatarMoeda(s.valorOrcamento)}</td>
              <td className="px-4 py-3 text-slate-500">{formatarData(s.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Board({ servicos }: { servicos: ServicoLinha[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
      {STATUS_ORDEM.map((status) => {
        const coluna = servicos.filter((s) => s.status === status);
        return (
          <div key={status} className="rounded-lg border border-slate-200 bg-slate-100/60 p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {STATUS_LABEL[status]}
              </span>
              <span className="text-xs text-slate-400">{coluna.length}</span>
            </div>
            <div className="space-y-2">
              {coluna.map((s) => (
                <div
                  key={s.id}
                  className="block rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm hover:border-slate-300"
                >
                  <Link href={`/servicos/${s.id}`} className="font-medium hover:underline">
                    {s.titulo}
                  </Link>
                  <div className="mt-2 flex items-center justify-between">
                    <PrioridadeBadge prioridade={s.prioridade} />
                    <span className="text-xs text-slate-500">
                      {formatarMoeda(s.valorOrcamento)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <StatusQuickChange id={s.id} status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
