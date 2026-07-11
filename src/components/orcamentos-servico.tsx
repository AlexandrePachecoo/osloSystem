'use client';

import { useActionState, useRef } from 'react';
import {
  adicionarOrcamento,
  removerOrcamento,
  selecionarOrcamento,
  type ActionState,
} from '@/actions/orcamentos';
import { formatarMoeda } from '@/lib/format';

export type OrcamentoItem = {
  id: string;
  fornecedor: string;
  valor: unknown;
  observacoes: string | null;
  selecionado: boolean;
};

export function OrcamentosServico({
  servicoId,
  orcamentos,
}: {
  servicoId: string;
  orcamentos: OrcamentoItem[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await adicionarOrcamento(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    { error: null },
  );

  const inputCls =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  return (
    <div className="space-y-4">
      {orcamentos.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum orçamento cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {orcamentos.map((o) => (
            <li
              key={o.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${
                o.selecionado
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{o.fornecedor}</span>
                  {o.selecionado && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Escolhido
                    </span>
                  )}
                </div>
                {o.observacoes && (
                  <p className="mt-1 whitespace-pre-wrap text-slate-500">{o.observacoes}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800">{formatarMoeda(o.valor)}</span>
                <form action={selecionarOrcamento}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="servicoId" value={servicoId} />
                  <button
                    type="submit"
                    className={`text-xs font-medium hover:underline ${
                      o.selecionado ? 'text-slate-500' : 'text-emerald-700'
                    }`}
                  >
                    {o.selecionado ? 'Desmarcar' : 'Escolher'}
                  </button>
                </form>
                <form
                  action={removerOrcamento}
                  onSubmit={(e) => {
                    if (!confirm('Remover este orçamento?')) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="servicoId" value={servicoId} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Remover
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4"
      >
        <input type="hidden" name="servicoId" value={servicoId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Empresa / fornecedor *</span>
            <input name="fornecedor" required placeholder="Ex.: Empresa X" className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Valor (R$) *</span>
            <input
              name="valor"
              type="number"
              step="0.01"
              min="0"
              required
              className={inputCls}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Observações</span>
          <input
            name="observacoes"
            placeholder="Ex.: prazo, garantia, condições…"
            className={inputCls}
          />
        </label>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? 'Adicionando…' : 'Adicionar orçamento'}
        </button>
      </form>
    </div>
  );
}
