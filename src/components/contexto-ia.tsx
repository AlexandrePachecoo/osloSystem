'use client';

import { useState } from 'react';
import { desativarNotaContexto } from '@/actions/assistente';
import { NotaContextoForm } from '@/components/nota-contexto-form';

export type NotaContextoItem = {
  id: string;
  texto: string;
  data: string; // já formatada no servidor
};

// Nota acima disso (ou com quebra de linha) começa recolhida em 2 linhas,
// com botão para expandir/minimizar.
const LIMITE_NOTA_LONGA = 120;

export function ContextoIA({ notas }: { notas: NotaContextoItem[] }) {
  const [minimizado, setMinimizado] = useState(false);

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-600">
            Contexto da IA{' '}
            <span className="font-normal text-slate-400">({notas.length})</span>
          </h2>
          <p className="text-xs text-slate-400">
            Avisos e informações que a IA usa ao responder moradores no WhatsApp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMinimizado((m) => !m)}
          className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {minimizado ? '▸ Expandir' : '▾ Minimizar'}
        </button>
      </div>

      {!minimizado && (
        <>
          <NotaContextoForm />
          {notas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma informação registrada.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notas.map((n) => (
                <NotaLinha key={n.id} nota={n} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function NotaLinha({ nota }: { nota: NotaContextoItem }) {
  const longa = nota.texto.length > LIMITE_NOTA_LONGA || nota.texto.includes('\n');
  const [aberta, setAberta] = useState(false);

  return (
    <li className="flex items-start justify-between gap-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p
          className={`whitespace-pre-wrap text-slate-700 ${
            longa && !aberta ? 'line-clamp-2' : ''
          }`}
        >
          {nota.texto}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-slate-400">{nota.data}</span>
          {longa && (
            <button
              type="button"
              onClick={() => setAberta((a) => !a)}
              className="text-xs text-blue-600 hover:underline"
            >
              {aberta ? 'Minimizar' : 'Ver tudo'}
            </button>
          )}
        </div>
      </div>
      <form action={desativarNotaContexto}>
        <input type="hidden" name="id" value={nota.id} />
        <button type="submit" className="shrink-0 text-xs text-slate-400 hover:text-red-600">
          Remover
        </button>
      </form>
    </li>
  );
}
