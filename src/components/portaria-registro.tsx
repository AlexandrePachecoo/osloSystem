'use client';

import { useRef, useState, useTransition } from 'react';
import { useActionState } from 'react';
import {
  registrarOcorrencia,
  registrarEncomenda,
  melhorarOcorrencia,
} from '@/actions/portaria';
import type { ActionState } from '@/actions/servicos';

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

// Registro da portaria: um único campo "colaborador" alimenta os dois
// formulários (ocorrência e encomenda) via input hidden.
export function PortariaRegistro({ funcionarios }: { funcionarios: string[] }) {
  const [colaborador, setColaborador] = useState('');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-sm sm:max-w-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Nome do colaborador (plantão) *
          </span>
          <input
            value={colaborador}
            onChange={(e) => setColaborador(e.target.value)}
            list="funcionarios-ativos"
            placeholder="Quem está registrando"
            className={inputCls}
          />
          <datalist id="funcionarios-ativos">
            {funcionarios.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OcorrenciaForm colaborador={colaborador} />
        <EncomendaForm colaborador={colaborador} />
      </div>
    </div>
  );
}

function OcorrenciaForm({ colaborador }: { colaborador: string }) {
  const [texto, setTexto] = useState('');
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [melhorando, startMelhorar] = useTransition();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const resultado = await registrarOcorrencia(prev, formData);
      if (!resultado.error) {
        setTexto('');
        setErroIA(null);
      }
      return resultado;
    },
    { error: null },
  );

  function melhorar() {
    setErroIA(null);
    startMelhorar(async () => {
      const resultado = await melhorarOcorrencia(texto);
      if (resultado.texto) setTexto(resultado.texto);
      else setErroIA(resultado.error);
    });
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-600">Registrar ocorrência</h2>
      <input type="hidden" name="colaborador" value={colaborador} />
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-500">Ocorrência *</span>
        <textarea
          name="texto"
          required
          rows={5}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: 21h40 — morador do apto 302 relatou barulho na garagem…"
          className={inputCls}
        />
      </label>
      {erroIA && <p className="text-sm text-amber-600">{erroIA}</p>}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={melhorar}
          disabled={melhorando || texto.trim() === ''}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {melhorando ? 'Melhorando…' : '✦ Melhorar texto com IA'}
        </button>
        <button
          type="submit"
          disabled={pending || melhorando}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? 'Registrando…' : 'Registrar ocorrência'}
        </button>
      </div>
    </form>
  );
}

function EncomendaForm({ colaborador }: { colaborador: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState<'interna' | 'externa'>('interna');

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const resultado = await registrarEncomenda(prev, formData);
      if (!resultado.error) {
        formRef.current?.reset();
        setTipo('interna');
      }
      return resultado;
    },
    { error: null },
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-slate-600">Registrar encomenda</h2>
      <input type="hidden" name="colaborador" value={colaborador} />
      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Apto *</span>
          <input name="apto" required placeholder="302" className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Descrição *</span>
          <input
            name="descricao"
            required
            placeholder="Caixa Mercado Livre, envelope…"
            className={inputCls}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Retirada *</span>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'interna' | 'externa')}
            className={inputCls}
          >
            <option value="interna">Interna (morador)</option>
            <option value="externa">Externa (pessoa de fora)</option>
          </select>
        </label>
        {tipo === 'externa' && (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Quem vai retirar *
            </span>
            <input
              name="retiradaPor"
              required
              placeholder="Nome de quem retira"
              className={inputCls}
            />
          </label>
        )}
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? 'Registrando…' : 'Registrar encomenda'}
      </button>
    </form>
  );
}
