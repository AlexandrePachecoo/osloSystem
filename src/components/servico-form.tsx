'use client';

import { useActionState } from 'react';
import { criarServico, atualizarServico, type ActionState } from '@/actions/servicos';
import { PRIORIDADE_LABEL } from '@/lib/format';
import { Prioridade } from '@/generated/prisma/enums';

export type ServicoFormDefaults = {
  id?: string;
  titulo?: string;
  descricao?: string;
  valorOrcamento?: string;
  prioridade?: Prioridade;
  empresaId?: string;
  empresaNome?: string;
  lembreteDias?: string;
};

export function ServicoForm({
  modo,
  defaults = {},
  empresas,
}: {
  modo: 'criar' | 'editar';
  defaults?: ServicoFormDefaults;
  empresas: { id: string; nome: string }[];
}) {
  const action = modo === 'criar' ? criarServico : atualizarServico;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {
    error: null,
  });

  const inputCls =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Título *</span>
        <input name="titulo" required defaultValue={defaults.titulo} className={inputCls} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Descrição</span>
        <textarea
          name="descricao"
          rows={4}
          defaultValue={defaults.descricao}
          className={inputCls}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Valor do orçamento (R$)</span>
          <input
            name="valorOrcamento"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaults.valorOrcamento}
            className={inputCls}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prioridade</span>
          <select
            name="prioridade"
            defaultValue={defaults.prioridade ?? 'media'}
            className={inputCls}
          >
            {Object.values(Prioridade).map((p) => (
              <option key={p} value={p}>
                {PRIORIDADE_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Empresa</span>
          <select name="empresaId" defaultValue={defaults.empresaId ?? ''} className={inputCls}>
            <option value="">— nenhuma —</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Empresa não cadastrada</span>
          <input
            name="empresaNome"
            placeholder="Só o nome — ex.: orçamento avulso"
            defaultValue={defaults.empresaNome}
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-slate-400">
            Ignorado se uma empresa cadastrada for selecionada.
          </span>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">
          Avisar novamente após (dias)
        </span>
        <input
          name="lembreteDias"
          type="number"
          min="1"
          max="365"
          step="1"
          placeholder="Padrão do sistema"
          defaultValue={defaults.lembreteDias}
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-slate-400">
          Sem mudança de status nesse prazo, um lembrete é criado. Resolver o lembrete adia o
          próximo aviso pelo mesmo prazo.
        </span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? 'Salvando…' : modo === 'criar' ? 'Criar serviço' : 'Salvar alterações'}
      </button>
    </form>
  );
}
