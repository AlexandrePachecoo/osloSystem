'use client';

import { useActionState } from 'react';
import {
  atualizarRascunho,
  aprovarRascunho,
  marcarComoEnviada,
  descartarRascunho,
} from '@/actions/mensagens';
import type { ActionState } from '@/actions/servicos';
import { PRIORIDADE_LABEL } from '@/lib/format';
import { Prioridade, type RascunhoStatus } from '@/generated/prisma/enums';
import { PrioridadeBadge } from '@/components/badges';

export type MensagemView = {
  id: string;
  autor: string;
  textoOriginal: string;
  prioridade: Prioridade | null;
  rascunhoResposta: string | null;
  rascunhoStatus: RascunhoStatus;
  recebidaEmFmt: string;
  // Coexistence: quando o admin já respondeu este contato pelo celular
  // (echo do app Business). null = sem resposta pelo app detectada.
  respondidaViaAppFmt: string | null;
};

const STATUS_RASCUNHO_LABEL: Record<RascunhoStatus, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  enviado: 'Enviado',
  descartado: 'Descartado',
};

const STATUS_RASCUNHO_CORES: Record<RascunhoStatus, string> = {
  pendente: 'bg-amber-100 text-amber-800',
  aprovado: 'bg-blue-100 text-blue-800',
  enviado: 'bg-emerald-100 text-emerald-800',
  descartado: 'bg-slate-200 text-slate-600',
};

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function MensagemCard({ mensagem }: { mensagem: MensagemView }) {
  const [salvarState, salvarAction, salvando] = useActionState<ActionState, FormData>(
    atualizarRascunho,
    { error: null },
  );
  const [statusState, aprovarFn, aprovando] = useActionState<ActionState, FormData>(
    aprovarRascunho,
    { error: null },
  );
  const [enviarState, enviarFn, enviando] = useActionState<ActionState, FormData>(
    marcarComoEnviada,
    { error: null },
  );
  const [descartarState, descartarFn, descartando] = useActionState<ActionState, FormData>(
    descartarRascunho,
    { error: null },
  );

  const editavel =
    mensagem.rascunhoStatus === 'pendente' || mensagem.rascunhoStatus === 'aprovado';
  const erro =
    salvarState.error ?? statusState.error ?? enviarState.error ?? descartarState.error;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{mensagem.autor}</span>
        <span className="text-xs text-slate-400">{mensagem.recebidaEmFmt}</span>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_RASCUNHO_CORES[mensagem.rascunhoStatus]}`}
        >
          {STATUS_RASCUNHO_LABEL[mensagem.rascunhoStatus]}
        </span>
        {mensagem.prioridade ? (
          <PrioridadeBadge prioridade={mensagem.prioridade} />
        ) : (
          <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            Sem classificação
          </span>
        )}
        {mensagem.respondidaViaAppFmt && editavel && (
          <span
            className="inline-block rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800"
            title={`Você respondeu este contato pelo celular em ${mensagem.respondidaViaAppFmt} — se resolveu, descarte o rascunho.`}
          >
            Respondida pelo celular · {mensagem.respondidaViaAppFmt}
          </span>
        )}
      </div>

      <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        {mensagem.textoOriginal}
      </p>

      {editavel ? (
        <form action={salvarAction} className="space-y-2">
          <input type="hidden" name="id" value={mensagem.id} />
          <div className="flex items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">Prioridade</span>
              <select
                name="prioridade"
                defaultValue={mensagem.prioridade ?? ''}
                className={inputCls}
              >
                <option value="">—</option>
                {Object.values(Prioridade).map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDADE_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1 text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Rascunho de resposta
              </span>
              <textarea
                name="rascunhoResposta"
                rows={2}
                defaultValue={mensagem.rascunhoResposta ?? ''}
                placeholder="Escreva ou edite o rascunho…"
                className={inputCls}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={salvando}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar edição'}
            </button>
            {mensagem.rascunhoStatus === 'pendente' && (
              <button
                type="submit"
                formAction={aprovarFn}
                disabled={aprovando}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {aprovando ? 'Aprovando…' : 'Aprovar'}
              </button>
            )}
            {mensagem.rascunhoStatus === 'aprovado' && (
              <button
                type="submit"
                formAction={enviarFn}
                disabled={enviando}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {enviando ? 'Enviando…' : 'Marcar como enviada'}
              </button>
            )}
            <button
              type="submit"
              formAction={descartarFn}
              disabled={descartando}
              className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              Descartar
            </button>
          </div>
        </form>
      ) : (
        mensagem.rascunhoResposta && (
          <p className="whitespace-pre-wrap rounded-md border border-slate-200 p-3 text-sm text-slate-600">
            <span className="mb-1 block text-xs font-medium text-slate-400">Resposta</span>
            {mensagem.rascunhoResposta}
          </p>
        )
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
