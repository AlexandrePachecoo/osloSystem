import { prisma } from '@/lib/prisma';
import { carregarRelatorioAberto } from '@/lib/portaria';
import { formatarData } from '@/lib/format';
import { baixarEntregaEncomenda, excluirOcorrencia, excluirEncomenda } from '@/actions/portaria';
import { PortariaRegistro } from '@/components/portaria-registro';
import { EnviarRelatorioPortaria } from '@/components/enviar-relatorio-portaria';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import type { EncomendaPortaria } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

function TipoBadge({ encomenda }: { encomenda: EncomendaPortaria }) {
  if (encomenda.tipo === 'externa') {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        externa — {encomenda.retiradaPor}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      interna
    </span>
  );
}

export default async function PortariaPage() {
  const [aberto, funcionarios, enviados] = await Promise.all([
    carregarRelatorioAberto(),
    prisma.funcionario.findMany({
      where: { status: 'ativo' },
      orderBy: { nome: 'asc' },
      select: { nome: true },
    }),
    prisma.relatorioPortaria.findMany({
      orderBy: { enviadoEm: 'desc' },
      take: 10,
      select: { id: true, colaborador: true, enviadoEm: true },
    }),
  ]);
  const nomes = funcionarios.map((f) => f.nome);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Relatório da portaria</h1>
        <a
          href="/api/portaria/relatorio/pdf"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ⬇ Baixar PDF do relatório atual
        </a>
      </div>

      <PortariaRegistro funcionarios={nomes} />

      {/* Ocorrências do relatório atual */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          Ocorrências do período{' '}
          <span className="text-sm font-normal text-slate-500">
            ({aberto.ocorrencias.length})
          </span>
        </h2>
        {aberto.ocorrencias.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma ocorrência registrada no período.</p>
        ) : (
          <ul className="space-y-2">
            {aberto.ocorrencias.map((o) => (
              <li
                key={o.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4"
              >
                <div>
                  <p className="text-xs text-slate-500">
                    {formatarData(o.createdAt)} — {o.colaborador}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{o.texto}</p>
                </div>
                <ConfirmDeleteButton
                  action={excluirOcorrencia}
                  id={o.id}
                  mensagem="Excluir esta ocorrência?"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Encomendas aguardando retirada — carregam de relatórios anteriores */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          Encomendas aguardando retirada{' '}
          <span className="text-sm font-normal text-slate-500">({aberto.pendentes.length})</span>
        </h2>
        {aberto.pendentes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma encomenda pendente.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Apto</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Retirada</th>
                  <th className="px-4 py-3">Recebida em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aberto.pendentes.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{e.apto}</td>
                    <td className="px-4 py-3">{e.descricao}</td>
                    <td className="px-4 py-3">
                      <TipoBadge encomenda={e} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatarData(e.createdAt)} — {e.colaborador}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <form action={baixarEntregaEncomenda}>
                          <input type="hidden" name="id" value={e.id} />
                          <button
                            type="submit"
                            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
                          >
                            ✓ Entrega feita
                          </button>
                        </form>
                        <ConfirmDeleteButton
                          action={excluirEncomenda}
                          id={e.id}
                          mensagem="Excluir esta encomenda? Use apenas para corrigir registro errado."
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Entregas baixadas desde o último envio */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          Entregues no período{' '}
          <span className="text-sm font-normal text-slate-500">({aberto.entregues.length})</span>
        </h2>
        {aberto.entregues.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma entrega baixada no período.</p>
        ) : (
          <ul className="space-y-2">
            {aberto.entregues.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm"
              >
                <span className="font-medium">Apto {e.apto}</span>
                <span>— {e.descricao}</span>
                <TipoBadge encomenda={e} />
                <span className="text-slate-500">
                  entregue em {e.entregueEm ? formatarData(e.entregueEm) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EnviarRelatorioPortaria funcionarios={nomes} />

      {/* Últimos relatórios enviados */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Relatórios enviados</h2>
        {enviados.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum relatório enviado ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {enviados.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {formatarData(r.enviadoEm)} — enviado por{' '}
                  <span className="font-medium">{r.colaborador}</span>
                </span>
                <a
                  href={`/api/portaria/relatorio/pdf?id=${r.id}`}
                  className="text-blue-700 hover:underline"
                >
                  Baixar PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
