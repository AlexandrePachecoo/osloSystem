'use client';

import { useRef, useState, useTransition } from 'react';
import { useActionState } from 'react';
import {
  adicionarAptoJornal,
  adicionarJornal,
  definirEntregaJornalApto,
  excluirAptoJornal,
  excluirJornal,
} from '@/actions/portaria';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import type { ActionState } from '@/actions/servicos';

export type JornalView = {
  id: string;
  nome: string;
  torre: string | null;
  aptos: { id: string; apto: string; entregue: boolean }[];
};

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

// Aba de jornais: cada jornal traz sua lista fixa de apartamentos assinantes.
// A portaria marca (checkbox) quais foram entregues no dia; ao enviar o
// relatório, as marcações zeram. Familiar ao relatório antigo ("Jornais
// entregues"), agrupado por torre.
export function JornaisPortaria({ jornais: inicial }: { jornais: JornalView[] }) {
  // Estado local espelha o servidor. Ressincroniza quando o snapshot muda
  // (ex.: envio do relatório zera todas as entregas) via assinatura estável.
  const assinatura = inicial
    .map((j) => `${j.id}:${j.aptos.map((a) => `${a.id}=${a.entregue ? 1 : 0}`).join('|')}`)
    .join(';');
  const [jornais, setJornais] = useState<JornalView[]>(inicial);
  const [assinaturaAnterior, setAssinaturaAnterior] = useState(assinatura);
  // Ressincroniza durante o render (padrão React) quando o servidor muda o
  // snapshot — ex.: o envio do relatório zera todas as marcações de entrega.
  if (assinatura !== assinaturaAnterior) {
    setAssinaturaAnterior(assinatura);
    setJornais(inicial);
  }

  const [abrindo, setAbrindo] = useState(false);

  function marcar(aptoId: string, entregue: boolean) {
    setJornais((prev) =>
      prev.map((j) => ({
        ...j,
        aptos: j.aptos.map((a) => (a.id === aptoId ? { ...a, entregue } : a)),
      })),
    );
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

      {jornais.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum jornal cadastrado. Use “Adicionar novo jornal” para começar.
        </p>
      ) : (
        <div className="space-y-2">
          {jornais.map((j) => (
            <JornalCard key={j.id} jornal={j} onMarcar={marcar} />
          ))}
        </div>
      )}
    </section>
  );
}

function JornalCard({
  jornal,
  onMarcar,
}: {
  jornal: JornalView;
  onMarcar: (aptoId: string, entregue: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [, startTransition] = useTransition();
  const entregues = jornal.aptos.filter((a) => a.entregue).length;

  function alternar(aptoId: string, entregue: boolean) {
    onMarcar(aptoId, entregue);
    startTransition(async () => {
      await definirEntregaJornalApto(aptoId, entregue);
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400">{aberto ? '▾' : '▸'}</span>
          <span className="font-medium">{jornal.nome}</span>
          {jornal.torre && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Torre {jornal.torre}
            </span>
          )}
        </span>
        <span className="text-xs text-slate-500">
          {entregues}/{jornal.aptos.length} entregues
        </span>
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          {jornal.aptos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum apartamento cadastrado neste jornal.</p>
          ) : (
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {jornal.aptos.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={a.entregue}
                      onChange={(e) => alternar(a.id, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={a.entregue ? 'font-medium text-slate-900' : 'text-slate-600'}>
                      {a.apto}
                    </span>
                  </label>
                  <ConfirmDeleteButton
                    action={excluirAptoJornal}
                    id={a.id}
                    mensagem={`Remover o apto ${a.apto} deste jornal?`}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <AdicionarAptoForm jornalId={jornal.id} />
            <ConfirmDeleteButton
              action={excluirJornal}
              id={jornal.id}
              mensagem={`Excluir o jornal “${jornal.nome}” e todos os seus apartamentos?`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AdicionarAptoForm({ jornalId }: { jornalId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await adicionarAptoJornal(formData);
        formRef.current?.reset();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="jornalId" value={jornalId} />
      <input
        name="apto"
        required
        maxLength={20}
        placeholder="Novo apto (ex.: 703 A)"
        className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Adicionar apto
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
