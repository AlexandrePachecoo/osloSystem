import type { Prioridade, ServicoStatus } from '@/generated/prisma/enums';
import { PRIORIDADE_LABEL, STATUS_LABEL } from '@/lib/format';

const STATUS_CORES: Record<ServicoStatus, string> = {
  orcamento: 'bg-amber-100 text-amber-800',
  aprovado: 'bg-blue-100 text-blue-800',
  em_andamento: 'bg-violet-100 text-violet-800',
  feito: 'bg-emerald-100 text-emerald-800',
  rejeitado: 'bg-slate-200 text-slate-600',
};

const PRIORIDADE_CORES: Record<Prioridade, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  media: 'bg-sky-100 text-sky-800',
  alta: 'bg-orange-100 text-orange-800',
  urgente: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: ServicoStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CORES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORIDADE_CORES[prioridade]}`}
    >
      {PRIORIDADE_LABEL[prioridade]}
    </span>
  );
}
