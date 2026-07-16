import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CopyButton } from '@/components/copy-button';
import { StatusBadge, PrioridadeBadge } from '@/components/badges';
import {
  STATUS_LABEL,
  STATUS_ORDEM,
  PRIORIDADE_LABEL,
  PRIORIDADE_ORDEM,
  formatarData,
} from '@/lib/format';
import type { RelatorioDados } from '@/domain/relatorio';

export const dynamic = 'force-dynamic';

// Renderiza o subconjunto de markdown que a IA produz (parágrafos, listas com
// "- " e **negrito**) sem depender de biblioteca externa.
function negrito(texto: string, chave: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? (
      <strong key={`${chave}-${i}`}>{parte.slice(2, -2)}</strong>
    ) : (
      <span key={`${chave}-${i}`}>{parte}</span>
    ),
  );
}

function ResumoIA({ texto }: { texto: string }) {
  const linhas = texto.split('\n');
  const blocos: ReactNode[] = [];
  let itens: string[] = [];

  const descarregarLista = () => {
    if (itens.length === 0) return;
    const atual = itens;
    blocos.push(
      <ul key={`ul-${blocos.length}`} className="ml-4 list-disc space-y-1">
        {atual.map((item, i) => (
          <li key={i}>{negrito(item, `li-${blocos.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    itens = [];
  };

  for (const linha of linhas) {
    const semEspaco = linha.trim();
    const itemLista = semEspaco.match(/^[-*]\s+(.*)$/);
    if (itemLista) {
      itens.push(itemLista[1]);
    } else if (semEspaco === '') {
      descarregarLista();
    } else {
      descarregarLista();
      blocos.push(
        <p key={`p-${blocos.length}`}>{negrito(semEspaco, `p-${blocos.length}`)}</p>,
      );
    }
  }
  descarregarLista();

  return <div className="space-y-2 text-sm leading-relaxed text-slate-700">{blocos}</div>;
}

export default async function RelatorioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const relatorio = await prisma.relatorio.findUnique({ where: { id } });
  if (!relatorio) notFound();

  const dados = relatorio.dados as RelatorioDados;
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
  const fimExibicao = new Date(relatorio.periodoFim.getTime() - 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/relatorios" className="text-sm text-slate-500 hover:underline">
          ← Relatórios
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          Semana de {fmt.format(relatorio.periodoInicio)} a {fmt.format(fimExibicao)}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerado em {formatarData(relatorio.createdAt)}
        </p>
      </div>

      {dados.resumoIA && (
        <section className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <span aria-hidden>✦</span>
            <h2 className="text-lg font-medium text-blue-900">Resumo e insights (IA)</h2>
          </div>
          <ResumoIA texto={dados.resumoIA} />
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUS_ORDEM.map((status) => (
          <div key={status} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold">{dados.porStatus[status] ?? 0}</div>
            <div className="mt-1 text-sm text-slate-500">{STATUS_LABEL[status]}</div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Prioridades pendentes (alta/urgente)</h2>
        {dados.prioridadesPendentes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma.</p>
        ) : (
          <ul className="space-y-2">
            {dados.prioridadesPendentes.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm"
              >
                <Link href={`/servicos/${s.id}`} className="font-medium hover:underline">
                  {s.titulo}
                </Link>
                <PrioridadeBadge prioridade={s.prioridade} />
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Lembretes ativos</h2>
        {dados.lembretesAtivos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum.</p>
        ) : (
          <ul className="space-y-2">
            {dados.lembretesAtivos.map((l, i) => (
              <li
                key={i}
                className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm"
              >
                {l.mensagem}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Estoque abaixo do mínimo</h2>
        {dados.estoqueAbaixoMinimo.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum item abaixo do mínimo.</p>
        ) : (
          <ul className="space-y-2">
            {dados.estoqueAbaixoMinimo.map((item, i) => (
              <li
                key={i}
                className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm"
              >
                <strong>{item.nome}</strong>: {item.quantidade} {item.unidade} (mínimo{' '}
                {item.quantidadeMinima})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Movimentações da semana</h2>
        {dados.mudancasNaSemana.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma mudança de status nesta semana.</p>
        ) : (
          <ul className="space-y-2">
            {dados.mudancasNaSemana.map((m, i) => (
              <li
                key={i}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm"
              >
                <span className="text-slate-500">
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'America/Sao_Paulo',
                  }).format(new Date(m.em))}
                </span>{' '}
                — <strong>{m.servicoTitulo}</strong>:{' '}
                {m.de ? `${STATUS_LABEL[m.de]} → ` : 'criado como '}
                {STATUS_LABEL[m.para]}
              </li>
            ))}
          </ul>
        )}
      </section>

      {dados.portaria && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Portaria na semana</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-2xl font-semibold">{dados.portaria.ocorrencias.length}</div>
              <div className="mt-1 text-sm text-slate-500">Ocorrências</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-2xl font-semibold">{dados.portaria.entregues}</div>
              <div className="mt-1 text-sm text-slate-500">Encomendas entregues</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-2xl font-semibold">{dados.portaria.pendentes}</div>
              <div className="mt-1 text-sm text-slate-500">Aguardando retirada</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-2xl font-semibold">
                {dados.portaria.relatoriosEnviados}
              </div>
              <div className="mt-1 text-sm text-slate-500">Relatórios enviados</div>
            </div>
          </div>
          {dados.portaria.ocorrencias.length > 0 && (
            <ul className="space-y-2">
              {dados.portaria.ocorrencias.map((o, i) => (
                <li
                  key={i}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm"
                >
                  <span className="text-slate-500">{formatarData(new Date(o.em))}</span> —{' '}
                  <strong>{o.colaborador}</strong>: {o.texto}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {dados.whatsapp && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">WhatsApp na semana</h2>
          <p className="text-sm text-slate-500">
            {dados.whatsapp.total}{' '}
            {dados.whatsapp.total === 1 ? 'mensagem recebida' : 'mensagens recebidas'}
          </p>
          <div className="flex flex-wrap gap-2">
            {PRIORIDADE_ORDEM.map((p) => (
              <span
                key={p}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm"
              >
                {PRIORIDADE_LABEL[p]}:{' '}
                <strong>{dados.whatsapp!.porPrioridade[p] ?? 0}</strong>
              </span>
            ))}
          </div>
          {dados.whatsapp.destaques.length > 0 && (
            <ul className="space-y-2">
              {dados.whatsapp.destaques.map((d, i) => (
                <li
                  key={i}
                  className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm"
                >
                  <span className="text-slate-500">{formatarData(new Date(d.em))}</span> —{' '}
                  {d.prioridade && <>{PRIORIDADE_LABEL[d.prioridade]} — </>}
                  <strong>{d.autor}</strong>: {d.texto}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Resumo para envio (markdown)</h2>
          <CopyButton texto={relatorio.resumo} />
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-700">
          {relatorio.resumo}
        </pre>
      </section>
    </div>
  );
}
