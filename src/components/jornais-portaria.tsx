'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useActionState } from 'react';
import {
  adicionarAptoJornal,
  adicionarJornal,
  definirEntregaJornalApto,
  definirEntregaVariosAptos,
  excluirAptoJornal,
} from '@/actions/portaria';
import type { ActionState } from '@/actions/servicos';

export type JornalView = {
  id: string;
  nome: string;
  torre: string | null;
  aptos: { id: string; apto: string; entregue: boolean }[];
};

// Uma linha da tabela: um apartamento assinante de um jornal.
type Linha = {
  aptoId: string;
  apto: string;
  jornalId: string;
  jornalNome: string;
  entregue: boolean;
};

type Grupo = {
  torre: string; // '' = sem torre
  linhas: Linha[];
  jornais: { id: string; nome: string }[]; // jornais desta torre (para "adicionar apto")
};

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

// Ordena por nome do jornal e, dentro do mesmo jornal, por apto (numérico).
const comparador = (a: Linha, b: Linha) =>
  a.jornalNome.localeCompare(b.jornalNome, 'pt-BR', { sensitivity: 'base' }) ||
  a.apto.localeCompare(b.apto, 'pt-BR', { numeric: true, sensitivity: 'base' });

// Monta os grupos por torre a partir dos jornais, já ordenados por nome.
function agrupar(jornais: JornalView[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const j of jornais) {
    const torre = j.torre ?? '';
    let grupo = mapa.get(torre);
    if (!grupo) {
      grupo = { torre, linhas: [], jornais: [] };
      mapa.set(torre, grupo);
    }
    grupo.jornais.push({ id: j.id, nome: j.nome });
    for (const a of j.aptos) {
      grupo.linhas.push({
        aptoId: a.id,
        apto: a.apto,
        jornalId: j.id,
        jornalNome: j.nome,
        entregue: a.entregue,
      });
    }
  }
  const grupos = [...mapa.values()];
  for (const g of grupos) {
    g.linhas.sort(comparador);
    g.jornais.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR', { sensitivity: 'base' }));
  }
  // Torres em ordem alfabética; "sem torre" por último.
  grupos.sort((a, b) => {
    if (a.torre === '') return 1;
    if (b.torre === '') return -1;
    return a.torre.localeCompare(b.torre, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });
  return grupos;
}

// Aba de jornais: uma tabela por torre (lado a lado), colunas
// check / apto / jornal. Marcar = entregue; o envio do relatório zera tudo.
export function JornaisPortaria({ jornais: inicial }: { jornais: JornalView[] }) {
  // Estado local espelha o servidor; ressincroniza no render quando o snapshot
  // muda (ex.: o envio do relatório zera todas as marcações).
  const assinatura = inicial
    .map((j) => `${j.id}:${j.aptos.map((a) => `${a.id}=${a.entregue ? 1 : 0}`).join('|')}`)
    .join(';');
  const [jornais, setJornais] = useState<JornalView[]>(inicial);
  const [assinaturaAnterior, setAssinaturaAnterior] = useState(assinatura);
  if (assinatura !== assinaturaAnterior) {
    setAssinaturaAnterior(assinatura);
    setJornais(inicial);
  }

  const [abrindo, setAbrindo] = useState(false);
  const [, startTransition] = useTransition();
  const grupos = useMemo(() => agrupar(jornais), [jornais]);

  function marcar(aptoIds: string[], entregue: boolean) {
    const alvo = new Set(aptoIds);
    setJornais((prev) =>
      prev.map((j) => ({
        ...j,
        aptos: j.aptos.map((a) => (alvo.has(a.id) ? { ...a, entregue } : a)),
      })),
    );
    startTransition(async () => {
      if (aptoIds.length === 1) await definirEntregaJornalApto(aptoIds[0], entregue);
      else await definirEntregaVariosAptos(aptoIds, entregue);
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Jornais entregues</h2>
        <button
          type="button"
          onClick={() => setAbrindo((v) => !v)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {abrindo ? 'Cancelar' : '+ Adicionar novo jornal'}
        </button>
      </div>

      {abrindo && <NovoJornalForm onDone={() => setAbrindo(false)} />}

      {grupos.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum jornal cadastrado. Use “Adicionar novo jornal” para começar.
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          {grupos.map((g) => (
            <TorreTabela key={g.torre || 'sem-torre'} grupo={g} onMarcar={marcar} />
          ))}
        </div>
      )}
    </section>
  );
}

function TorreTabela({
  grupo,
  onMarcar,
}: {
  grupo: Grupo;
  onMarcar: (aptoIds: string[], entregue: boolean) => void;
}) {
  const [minimizado, setMinimizado] = useState(false);
  const titulo = grupo.torre ? `Torre ${grupo.torre}` : 'Sem torre';
  const todosIds = grupo.linhas.map((l) => l.aptoId);
  const entregues = grupo.linhas.filter((l) => l.entregue).length;
  const todosMarcados = grupo.linhas.length > 0 && entregues === grupo.linhas.length;

  return (
    <div className="min-w-[280px] flex-1 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="flex items-center gap-2 font-semibold text-slate-800">
          {titulo}
          <span className="text-xs font-normal text-slate-500">
            {entregues}/{grupo.linhas.length}
          </span>
        </span>
        <div className="flex items-center gap-1">
          {!minimizado && grupo.linhas.length > 0 && (
            <button
              type="button"
              onClick={() => onMarcar(todosIds, !todosMarcados)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
            >
              {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMinimizado((v) => !v)}
            aria-label={minimizado ? 'Expandir' : 'Minimizar'}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
          >
            {minimizado ? '▸' : '▾'}
          </button>
        </div>
      </div>

      {!minimizado && (
        <>
          {grupo.linhas.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">Nenhum apartamento cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-2 py-2">Apto</th>
                  <th className="px-2 py-2">Jornal</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grupo.linhas.map((l) => (
                  <tr key={l.aptoId} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={l.entregue}
                        onChange={(e) => onMarcar([l.aptoId], e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td
                      className={`px-2 py-1.5 ${l.entregue ? 'font-medium text-slate-900' : 'text-slate-600'}`}
                    >
                      {l.apto}
                    </td>
                    <td
                      className={`px-2 py-1.5 ${l.entregue ? 'text-slate-900' : 'text-slate-600'}`}
                    >
                      {l.jornalNome}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <form
                        action={excluirAptoJornal}
                        onSubmit={(e) => {
                          if (!confirm(`Remover ${l.apto} — ${l.jornalNome}?`)) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={l.aptoId} />
                        <button
                          type="submit"
                          aria-label="Remover"
                          className="text-slate-300 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {grupo.jornais.length > 0 && <AdicionarAptoForm jornais={grupo.jornais} />}
        </>
      )}
    </div>
  );
}

function AdicionarAptoForm({ jornais }: { jornais: { id: string; nome: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await adicionarAptoJornal(formData);
        formRef.current?.reset();
      }}
      className="flex items-center gap-2 border-t border-slate-100 px-3 py-2"
    >
      <input
        name="apto"
        required
        maxLength={20}
        placeholder="Apto"
        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />
      <select
        name="jornalId"
        defaultValue={jornais[0]?.id}
        className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      >
        {jornais.map((j) => (
          <option key={j.id} value={j.id}>
            {j.nome}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md border border-slate-300 px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        +
      </button>
    </form>
  );
}

function NovoJornalForm({ onDone }: { onDone: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const resultado = await adicionarJornal(prev, formData);
      if (!resultado.error) {
        formRef.current?.reset();
        onDone();
      }
      return resultado;
    },
    { error: null },
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Nome do jornal *</span>
          <input name="nome" required placeholder="Ex.: Zero Hora" className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Torre</span>
          <input name="torre" placeholder="Ex.: A" className={inputCls} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Apartamentos assinantes * (um por linha ou separados por vírgula)
        </span>
        <textarea
          name="aptos"
          required
          rows={4}
          placeholder={'703 A\n704 A\n1801 A'}
          className={inputCls}
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar jornal'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
