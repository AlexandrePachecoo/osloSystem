'use client';

import { useActionState } from 'react';
import { criarItemEstoque, atualizarItemEstoque } from '@/actions/estoque';
import type { ActionState } from '@/actions/servicos';

export type ItemEstoqueDefaults = {
  id?: string;
  nome?: string;
  quantidade?: number;
  quantidadeMinima?: number;
  unidade?: string;
};

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function EstoqueForm({
  modo,
  defaults = {},
}: {
  modo: 'criar' | 'editar';
  defaults?: ItemEstoqueDefaults;
}) {
  const action = modo === 'criar' ? criarItemEstoque : atualizarItemEstoque;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {
    error: null,
  });

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Nome *</span>
        <input name="nome" required defaultValue={defaults.nome} className={inputCls} />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Quantidade *</span>
          <input
            name="quantidade"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={defaults.quantidade}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Mínimo *</span>
          <input
            name="quantidadeMinima"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={defaults.quantidadeMinima}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Unidade *</span>
          <input
            name="unidade"
            required
            placeholder="un, kg, L…"
            defaultValue={defaults.unidade}
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
        {pending ? 'Salvando…' : modo === 'criar' ? 'Adicionar item' : 'Salvar alterações'}
      </button>
    </form>
  );
}
