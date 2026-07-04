'use client';

import { useActionState } from 'react';
import { criarFuncionario, atualizarFuncionario } from '@/actions/funcionarios';
import type { ActionState } from '@/actions/servicos';
import type { FuncionarioStatus } from '@/generated/prisma/enums';

export type FuncionarioDefaults = {
  id?: string;
  nome?: string;
  funcao?: string;
  contato?: string;
  status?: FuncionarioStatus;
};

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function FuncionarioForm({
  modo,
  defaults = {},
}: {
  modo: 'criar' | 'editar';
  defaults?: FuncionarioDefaults;
}) {
  const action = modo === 'criar' ? criarFuncionario : atualizarFuncionario;
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
          <span className="mb-1 block font-medium text-slate-700">Função *</span>
          <input
            name="funcao"
            required
            placeholder="Zelador, porteiro…"
            defaultValue={defaults.funcao}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Status</span>
          <select name="status" defaultValue={defaults.status ?? 'ativo'} className={inputCls}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Contato</span>
        <input
          name="contato"
          placeholder="Telefone, e-mail…"
          defaultValue={defaults.contato}
          className={inputCls}
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? 'Salvando…' : modo === 'criar' ? 'Cadastrar funcionário' : 'Salvar alterações'}
      </button>
    </form>
  );
}
