'use client';

import { useRef } from 'react';
import { useActionState } from 'react';
import { simularMensagemRecebida } from '@/actions/mensagens';
import type { ActionState } from '@/actions/servicos';

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

// Alimentação manual do mock: simula uma mensagem chegando do grupo.
export function SimularMensagemForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const resultado = await simularMensagemRecebida(prev, formData);
      if (!resultado.error) formRef.current?.reset();
      return resultado;
    },
    { error: null },
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"
    >
      <h2 className="text-sm font-semibold text-slate-600">
        Simular mensagem recebida (mock do WhatsApp)
      </h2>
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Autor</span>
          <input name="autor" required placeholder="Maria (apto 302)" className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Mensagem</span>
          <input
            name="texto"
            required
            placeholder="Tem um vazamento na garagem…"
            className={inputCls}
          />
        </label>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? 'Processando…' : 'Receber mensagem'}
      </button>
    </form>
  );
}
