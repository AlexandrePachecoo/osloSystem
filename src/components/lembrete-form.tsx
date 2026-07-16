'use client';

import { useRef } from 'react';
import { useActionState } from 'react';
import { criarLembrete } from '@/actions/lembretes';
import type { ActionState } from '@/actions/servicos';

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function LembreteForm({ servicos }: { servicos: { id: string; titulo: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const resultado = await criarLembrete(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    { error: null },
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-slate-600">Novo lembrete</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px_200px]">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Mensagem *</span>
          <input
            name="mensagem"
            required
            placeholder="Cobrar orçamento do portão eletrônico…"
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Serviço (opcional)
          </span>
          <select name="servicoId" defaultValue="" className={inputCls}>
            <option value="">— nenhum —</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Agendar para (opcional)
          </span>
          <input type="date" name="agendadoPara" className={inputCls} />
          <span className="mt-1 block text-xs text-slate-400">
            Só aparece no painel a partir dessa data.
          </span>
        </label>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? 'Criando…' : 'Criar lembrete'}
      </button>
    </form>
  );
}
