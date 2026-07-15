import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { gerarRelatorioAgora } from '@/actions/relatorios';
import { formatarData } from '@/lib/format';

export const dynamic = 'force-dynamic';

function formatarPeriodo(inicio: Date, fim: Date): string {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
  const fimExibicao = new Date(fim.getTime() - 24 * 60 * 60 * 1000);
  return `${fmt.format(inicio)} a ${fmt.format(fimExibicao)}`;
}

export default async function RelatoriosPage() {
  const [relatorios, relatoriosPortaria] = await Promise.all([
    prisma.relatorio.findMany({
      orderBy: { periodoInicio: 'desc' },
      take: 52,
      select: { id: true, periodoInicio: true, periodoFim: true, createdAt: true },
    }),
    prisma.relatorioPortaria.findMany({
      orderBy: { enviadoEm: 'desc' },
      take: 52,
      select: { id: true, colaborador: true, enviadoEm: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Relatórios semanais</h1>
        <form action={gerarRelatorioAgora}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Gerar relatório da semana
          </button>
        </form>
      </div>

      {relatorios.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum relatório ainda. O cron gera um todo domingo às 20h, ou clique em
          &ldquo;Gerar relatório da semana&rdquo;.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Gerado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {relatorios.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/relatorios/${r.id}`} className="font-medium hover:underline">
                      {formatarPeriodo(r.periodoInicio, r.periodoFim)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatarData(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Relatórios da portaria</h2>
        {relatoriosPortaria.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum relatório da portaria ainda. O funcionário envia pelo botão &ldquo;Enviar
            relatório&rdquo; na aba Portaria.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Enviado em</th>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relatoriosPortaria.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/relatorios/portaria/${r.id}`}
                        className="font-medium hover:underline"
                      >
                        {formatarData(r.enviadoEm)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.colaborador}</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/api/portaria/relatorio/pdf?id=${r.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        Baixar PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
