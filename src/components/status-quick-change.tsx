'use client';

import { useActionState, useRef } from 'react';
import { mudarStatusServico, type ActionState } from '@/actions/servicos';
import { transicoesValidas } from '@/domain/servico-status';
import { STATUS_LABEL } from '@/lib/format';
import { StatusBadge } from '@/components/badges';
import type { ServicoStatus } from '@/generated/prisma/enums';

// Troca de status direto na lista/board, sem abrir o serviço.
// Um <select> com o status atual + as transições válidas; escolher um destino
// dispara a ação na hora.
export function StatusQuickChange({
  id,
  status,
}: {
  id: string;
  status: ServicoStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mudarStatusServico,
    { error: null },
  );
  const destinos = transicoesValidas(status);

  // Status terminal (feito/rejeitado): nada a mudar, só mostra o selo.
  if (destinos.length === 0) {
    return <StatusBadge status={status} />;
  }

  return (
    <form ref={formRef} action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <select
        name="paraStatus"
        defaultValue={status}
        disabled={pending}
        aria-label="Mudar status"
        onChange={(e) => {
          if (e.target.value !== status) formRef.current?.requestSubmit();
        }}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-50"
      >
        <option value={status}>{STATUS_LABEL[status]}</option>
        {destinos.map((destino) => (
          <option key={destino} value={destino}>
            → {STATUS_LABEL[destino]}
          </option>
        ))}
      </select>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
