'use client';

import { useRef, useState } from 'react';
import { useActionState } from 'react';
import { enviarRelatorioPortaria } from '@/actions/portaria';
import type { ActionState } from '@/actions/servicos';

// Fecha o relatório aberto e envia para a administração. O sucesso é
// confirmado na própria página (as listas do período zeram e o relatório
// aparece em "enviados"), mas mostramos a mensagem mesmo assim.
export function EnviarRelatorioPortaria({ funcionarios }: { funcionarios: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [enviado, setEnviado] = useState(false);

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      setEnviado(false);
      const resultado = await enviarRelatorioPortaria(prev, formData);
      if (!resultado.error) {
        formRef.current?.reset();
        setEnviado(true);
      }
      return resultado;
    },
    { error: null },
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4"
    >
      <h2 className="text-sm font-semibold text-blue-900">Enviar para a administração</h2>
      <p className="text-xs text-blue-800">
        Fecha o relatório atual (ocorrências + entregas do período) e o disponibiliza para a
        administração. Encomendas ainda não retiradas seguem para o próximo relatório
        automaticamente.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-blue-900">
            Colaborador que envia *
          </span>
          <input
            name="colaborador"
            required
            list="funcionarios-envio"
            placeholder="Seu nome"
            className="w-64 rounded-md border border-blue-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <datalist id="funcionarios-envio">
            {funcionarios.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar relatório'}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {enviado && !state.error && (
        <p className="text-sm font-medium text-green-700">
          Relatório enviado para a administração ✓
        </p>
      )}
    </form>
  );
}
