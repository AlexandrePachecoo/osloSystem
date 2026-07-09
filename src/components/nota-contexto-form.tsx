'use client';

import { useRef } from 'react';
import { useActionState } from 'react';
import { criarNotaContexto } from '@/actions/assistente';
import type { ActionState } from '@/actions/servicos';

export function NotaContextoForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const resultado = await criarNotaContexto(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    { error: null },
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="texto"
          required
          placeholder="Ex.: festa junina no salão dia 12/09 às 19h"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
