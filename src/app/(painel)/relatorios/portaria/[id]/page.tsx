import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CopyButton } from '@/components/copy-button';
import { formatarData } from '@/lib/format';
import {
  agruparJornaisPorTorre,
  descreverEncomenda,
  type DadosRelatorioPortaria,
} from '@/lib/portaria';

export const dynamic = 'force-dynamic';

export default async function RelatorioPortariaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const relatorio = await prisma.relatorioPortaria.findUnique({ where: { id } });
  if (!relatorio) notFound();

  const dados = relatorio.dados as DadosRelatorioPortaria;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/relatorios" className="text-sm text-slate-500 hover:underline">
            ← Relatórios
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Relatório da portaria</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enviado por <span className="font-medium">{relatorio.colaborador}</span> em{' '}
            {formatarData(relatorio.enviadoEm)}
          </p>
        </div>
        <a
          href={`/api/portaria/relatorio/pdf?id=${relatorio.id}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ⬇ Baixar PDF
        </a>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Ocorrências ({dados.ocorrencias.length})</h2>
        {dados.ocorrencias.length === 0 ? (
          <p className="text-sm text-slate-500">Sem ocorrências no período.</p>
        ) : (
          <ul className="space-y-2">
            {dados.ocorrencias.map((o, i) => (
              <li key={i} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">
                  {formatarData(new Date(o.registradaEm))} — {o.colaborador}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{o.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Encomendas entregues ({dados.entregues.length})</h2>
        {dados.entregues.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma entrega baixada no período.</p>
        ) : (
          <ul className="space-y-2">
            {dados.entregues.map((e, i) => (
              <li
                key={i}
                className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm"
              >
                {descreverEncomenda(e)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Jornais entregues</h2>
        {!dados.jornais || dados.jornais.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum jornal entregue no período.</p>
        ) : (
          <div className="space-y-3">
            {agruparJornaisPorTorre(dados.jornais).map(([torre, doTorre]) => (
              <div key={torre || 'sem-torre'} className="space-y-1">
                {torre && (
                  <p className="text-sm font-semibold text-slate-700">Torre {torre}</p>
                )}
                <ul className="space-y-1">
                  {doTorre.map((j, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm"
                    >
                      <span className="font-medium">{j.nome}:</span>{' '}
                      {j.aptosEntregues.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">
          Aguardando retirada no envio ({dados.pendentes.length})
        </h2>
        {dados.pendentes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma encomenda pendente.</p>
        ) : (
          <ul className="space-y-2">
            {dados.pendentes.map((e, i) => (
              <li
                key={i}
                className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm"
              >
                {descreverEncomenda(e)}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">
          Pendentes deste envio seguem aparecendo nos relatórios seguintes até a baixa da entrega.
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Resumo em texto</h2>
          <CopyButton texto={relatorio.resumo} />
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-700">
          {relatorio.resumo}
        </pre>
      </section>
    </div>
  );
}
