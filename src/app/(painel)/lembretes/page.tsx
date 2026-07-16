import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  adiarLembrete,
  anteciparLembrete,
  resolverLembrete,
  retomarLembrete,
} from '@/actions/lembretes';
import { formatarData } from '@/lib/format';
import { StatusBadge } from '@/components/badges';
import { LembreteForm } from '@/components/lembrete-form';
import { STATUS_TERMINAIS } from '@/domain/servico-status';

export const dynamic = 'force-dynamic';

export default async function LembretesPage() {
  const [lembretes, servicosAtivos] = await Promise.all([
    prisma.lembrete.findMany({
      orderBy: [{ resolvido: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      include: { servico: { select: { id: true, titulo: true, status: true } } },
    }),
    prisma.servico.findMany({
      where: { status: { notIn: [...STATUS_TERMINAIS] } },
      select: { id: true, titulo: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const agora = new Date().getTime();
  const naoResolvidos = lembretes.filter((l) => !l.resolvido);
  const estaAdiado = (l: (typeof lembretes)[number]) =>
    l.adiadoAte !== null && l.adiadoAte.getTime() > agora;
  const estaAgendado = (l: (typeof lembretes)[number]) =>
    l.agendadoPara !== null && l.agendadoPara.getTime() > agora;
  // Adiar tem precedência sobre agendar na hora de classificar a exibição.
  const ativos = naoResolvidos.filter((l) => !estaAdiado(l) && !estaAgendado(l));
  const adiados = naoResolvidos.filter(estaAdiado);
  const agendados = naoResolvidos.filter((l) => !estaAdiado(l) && estaAgendado(l));
  const resolvidos = lembretes.filter((l) => l.resolvido);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Lembretes</h1>

      <LembreteForm servicos={servicosAtivos} />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Ativos ({ativos.length})</h2>
        {ativos.length === 0 && (
          <p className="text-sm text-slate-500">Nenhum lembrete ativo. 🎉</p>
        )}
        {ativos.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"
          >
            <div>
              {l.servico ? (
                <>
                  <Link
                    href={`/servicos/${l.servico.id}`}
                    className="font-medium hover:underline"
                  >
                    {l.servico.titulo}
                  </Link>{' '}
                  <StatusBadge status={l.servico.status} />
                </>
              ) : (
                <span className="font-medium text-slate-600">Lembrete avulso</span>
              )}
              <p className="mt-1 text-slate-600">{l.mensagem}</p>
              <p className="mt-1 text-xs text-slate-400">{formatarData(l.createdAt)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <form action={adiarLembrete}>
                <input type="hidden" name="id" value={l.id} />
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  Adiar
                </button>
              </form>
              <form action={resolverLembrete}>
                <input type="hidden" name="id" value={l.id} />
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Feito
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>

      {adiados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-slate-500">Adiados ({adiados.length})</h2>
          {adiados.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
            >
              <div>
                {l.servico ? (
                  <Link
                    href={`/servicos/${l.servico.id}`}
                    className="font-medium hover:underline"
                  >
                    {l.servico.titulo}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-600">Lembrete avulso</span>
                )}
                <p className="mt-1 text-slate-600">{l.mensagem}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Adiado até {formatarData(l.adiadoAte!)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={retomarLembrete}>
                  <input type="hidden" name="id" value={l.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Retomar
                  </button>
                </form>
                <form action={resolverLembrete}>
                  <input type="hidden" name="id" value={l.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    Feito
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      {agendados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-slate-500">Agendados ({agendados.length})</h2>
          {agendados.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
            >
              <div>
                {l.servico ? (
                  <Link
                    href={`/servicos/${l.servico.id}`}
                    className="font-medium hover:underline"
                  >
                    {l.servico.titulo}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-600">Lembrete avulso</span>
                )}
                <p className="mt-1 text-slate-600">{l.mensagem}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Agendado para {formatarData(l.agendadoPara!)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={anteciparLembrete}>
                  <input type="hidden" name="id" value={l.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Antecipar
                  </button>
                </form>
                <form action={resolverLembrete}>
                  <input type="hidden" name="id" value={l.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    Feito
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      {resolvidos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-slate-500">Resolvidos</h2>
          {resolvidos.map((l) => (
            <div
              key={l.id}
              className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400"
            >
              {l.servico ? (
                <Link
                  href={`/servicos/${l.servico.id}`}
                  className="font-medium text-slate-500 hover:underline"
                >
                  {l.servico.titulo}
                </Link>
              ) : (
                <span className="font-medium text-slate-500">Lembrete avulso</span>
              )}
              <p className="mt-1">{l.mensagem}</p>
              <p className="mt-1 text-xs">{formatarData(l.createdAt)}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
