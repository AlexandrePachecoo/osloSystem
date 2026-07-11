import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { StatusBadge, PrioridadeBadge } from '@/components/badges';
import { StatusActions } from '@/components/status-actions';
import { OrcamentosServico } from '@/components/orcamentos-servico';
import { DeleteServicoButton } from '@/components/delete-servico-button';
import { STATUS_LABEL, formatarData, formatarMoeda } from '@/lib/format';
import { STATUS_TERMINAIS } from '@/domain/servico-status';

export const dynamic = 'force-dynamic';

export default async function ServicoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const servico = await prisma.servico.findUnique({
    where: { id },
    include: {
      empresa: { select: { nome: true } },
      statusLogs: { orderBy: { createdAt: 'desc' } },
      lembretes: { where: { resolvido: false } },
      orcamentos: { orderBy: [{ selecionado: 'desc' }, { valor: 'asc' }] },
    },
  });
  if (!servico) notFound();

  const podeExcluir =
    STATUS_TERMINAIS.includes(servico.status) || servico.status === 'orcamento';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/servicos" className="text-sm text-slate-500 hover:underline">
            ← Serviços
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{servico.titulo}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={servico.status} />
            <PrioridadeBadge prioridade={servico.prioridade} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/servicos/${servico.id}/editar`}
            className="text-sm text-blue-600 hover:underline"
          >
            Editar
          </Link>
          {podeExcluir && <DeleteServicoButton id={servico.id} />}
        </div>
      </div>

      {servico.lembretes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          {servico.lembretes.map((l) => (
            <p key={l.id}>⚠ {l.mensagem}</p>
          ))}
        </div>
      )}

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 text-sm sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Descrição</div>
          <p className="mt-1 whitespace-pre-wrap">{servico.descricao ?? '—'}</p>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Empresa</div>
            <p className="mt-1">
              {servico.empresa?.nome ??
                (servico.empresaNome ? `${servico.empresaNome} (sem cadastro)` : '—')}
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Avisar novamente após
            </div>
            <p className="mt-1">
              {servico.lembreteDias
                ? `${servico.lembreteDias} dias`
                : 'Padrão do sistema'}
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Orçamento</div>
            <p className="mt-1">{formatarMoeda(servico.valorOrcamento)}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Criado em</div>
            <p className="mt-1">{formatarData(servico.createdAt)}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Última mudança de status
            </div>
            <p className="mt-1">{formatarData(servico.statusChangedAt)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mudar status</h2>
        <StatusActions id={servico.id} status={servico.status} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Orçamentos</h2>
        <p className="text-sm text-slate-500">
          Compare propostas de empresas diferentes para este serviço e marque a escolhida.
        </p>
        <OrcamentosServico
          servicoId={servico.id}
          orcamentos={servico.orcamentos.map((o) => ({
            id: o.id,
            fornecedor: o.fornecedor,
            valor: o.valor,
            observacoes: o.observacoes,
            selecionado: o.selecionado,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Histórico de status</h2>
        <ol className="space-y-2 text-sm">
          {servico.statusLogs.map((log) => (
            <li
              key={log.id}
              className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-2"
            >
              <span className="text-slate-500">{formatarData(log.createdAt)}</span>
              <span>
                {log.deStatus ? `${STATUS_LABEL[log.deStatus]} → ` : 'Criado como '}
                <strong>{STATUS_LABEL[log.paraStatus]}</strong>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
