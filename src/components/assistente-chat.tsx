'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { enviarMensagemAssistente } from '@/actions/assistente';
import type { ChatTurno } from '@/lib/assistente';

// Chat box do painel: o admin conversa com a IA que executa ações no sistema
// (criar serviço em andamento, salvar aviso para os moradores, lembrete,
// estoque). O histórico vive no estado do cliente — recarregar a página
// começa uma conversa nova.
export function AssistenteChat({ disponivel }: { disponivel: boolean }) {
  const [turnos, setTurnos] = useState<ChatTurno[]>([]);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turnos, pending]);

  function enviar() {
    const conteudo = texto.trim();
    if (!conteudo || pending) return;

    const historico: ChatTurno[] = [...turnos, { role: 'user', content: conteudo }];
    setTurnos(historico);
    setTexto('');
    setErro(null);

    startTransition(async () => {
      const resultado = await enviarMensagemAssistente(historico);
      if (resultado.erro !== null) {
        setErro(resultado.erro);
        return;
      }
      setTurnos([...historico, { role: 'assistant', content: resultado.resposta }]);
    });
  }

  return (
    <section className="flex flex-col rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-600">Assistente</h2>
        <p className="text-xs text-slate-400">
          Relate um fato ou dê um aviso — a IA cria serviços, lembretes e contexto por você.
        </p>
      </div>

      <div className="max-h-80 min-h-40 flex-1 space-y-3 overflow-y-auto p-4">
        {turnos.length === 0 && (
          <p className="text-sm text-slate-400">
            Ex.: “Está acontecendo um vazamento no S2, o funcionário da empresa X já está
            resolvendo” ou “Aviso: festa junina no salão dia 12/09 às 19h”.
          </p>
        )}
        {turnos.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                t.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {t.content}
            </div>
          </div>
        ))}
        {pending && <p className="text-sm text-slate-400">Pensando…</p>}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div ref={fimRef} />
      </div>

      <div className="border-t border-slate-100 p-3">
        {disponivel ? (
          <div className="flex gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={2}
              placeholder="Escreva para o assistente…"
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={enviar}
              disabled={pending || !texto.trim()}
              className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Configure a variável OPENAI_API_KEY para ativar o assistente.
          </p>
        )}
      </div>
    </section>
  );
}
