'use client';

import { useActionState } from 'react';
import { criarEmpresa, atualizarEmpresa } from '@/actions/empresas';
import type { ActionState } from '@/actions/servicos';

export type EmpresaDefaults = {
  id?: string;
  nome?: string;
  contato?: string;
  categoria?: string;
  observacoes?: string;
};

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function EmpresaForm({
  modo,
  defaults = {},
}: {
  modo: 'criar' | 'editar';
  defaults?: EmpresaDefaults;
}) {
  const action = modo === 'criar' ? criarEmpresa : atualizarEmpresa;
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

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Contato</span>
          <input
            name="contato"
            placeholder="Telefone, e-mail…"
            defaultValue={defaults.contato}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Categoria</span>
          <input
            name="categoria"
            placeholder="Elétrica, hidráulica…"
            defaultValue={defaults.categoria}
            className={inputCls}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Observações</span>
        <textarea
          name="observacoes"
          rows={3}
          defaultValue={defaults.observacoes}
          className={inputCls}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? 'Salvando…' : modo === 'criar' ? 'Cadastrar empresa' : 'Salvar alterações'}
      </button>
    </form>
  );
}
