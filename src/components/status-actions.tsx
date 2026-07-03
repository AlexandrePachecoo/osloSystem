'use client';

import { useActionState } from 'react';
import { mudarStatusServico, type ActionState } from '@/actions/servicos';
import { transicoesValidas } from '@/domain/servico-status';
import { STATUS_LABEL } from '@/lib/format';
import type { ServicoStatus } from '@/generated/prisma/enums';

const BOTAO_CORES: Partial<Record<ServicoStatus, string>> = {
  aprovado: 'bg-blue-600 hover:bg-blue-500',
  em_andamento: 'bg-violet-600 hover:bg-violet-500',
  feito: 'bg-emerald-600 hover:bg-emerald-500',
  rejeitado: 'bg-slate-500 hover:bg-slate-400',
};

export function StatusActions({ id, status }: { id: string; status: ServicoStatus }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mudarStatusServico,
    { error: null },
  );
  const destinos = transicoesValidas(status);

  if (destinos.length === 0) {
    return <p className="text-sm text-slate-400">Status terminal — sem transições.</p>;
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        {destinos.map((destino) => (
          <button
            key={destino}
            type="submit"
            name="paraStatus"
            value={destino}
            disabled={pending}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
              BOTAO_CORES[destino] ?? 'bg-slate-600'
            }`}
          >
            → {STATUS_LABEL[destino]}
          </button>
        ))}
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
