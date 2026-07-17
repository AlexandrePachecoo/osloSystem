'use client';

import { useEffect, useState } from 'react';
import {
  salvarInscricaoPush,
  removerInscricaoPush,
  enviarPushTeste,
} from '@/actions/push';

// Converte a chave pública VAPID (base64url) para o Uint8Array que o
// PushManager espera. (Padrão da doc de PWA do Next.)
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  // Buffer explícito p/ o tipo casar com BufferSource (applicationServerKey).
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Estado = 'carregando' | 'inscrito' | 'nao_inscrito' | 'sem_suporte';

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    // Toda a decisão de estado acontece dentro deste callback assíncrono
    // (sincronizando com APIs externas do browser), fora do corpo síncrono
    // do efeito.
    (async () => {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        if (!cancelado) setEstado('sem_suporte');
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        const sub = await registration.pushManager.getSubscription();
        if (!cancelado) setEstado(sub ? 'inscrito' : 'nao_inscrito');
      } catch (erro) {
        console.error('[push] falha ao registrar service worker:', erro);
        if (!cancelado) setEstado('sem_suporte');
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  async function ativar() {
    if (!vapidPublicKey) return;
    setAviso(null);
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setAviso('Permissão de notificação negada no navegador.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const resultado = await salvarInscricaoPush(JSON.parse(JSON.stringify(sub)));
      if (!resultado.ok) {
        setAviso(resultado.error ?? 'Não foi possível salvar a inscrição.');
        await sub.unsubscribe().catch(() => {});
        return;
      }
      setEstado('inscrito');
    } catch (erro) {
      console.error('[push] falha ao ativar notificações:', erro);
      setAviso('Não foi possível ativar as notificações.');
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setAviso(null);
    setOcupado(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await removerInscricaoPush(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setEstado('nao_inscrito');
    } catch (erro) {
      console.error('[push] falha ao desativar notificações:', erro);
      setAviso('Não foi possível desativar as notificações.');
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setAviso(null);
    setOcupado(true);
    try {
      const resultado = await enviarPushTeste();
      if (!resultado.ok) setAviso(resultado.error ?? 'Falha ao enviar o teste.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-600">Notificações no celular</h2>
        <p className="text-xs text-slate-400">
          Receba avisos de novos lembretes e de mensagens do WhatsApp aguardando
          aprovação — mesmo com o app fechado.
        </p>
      </div>

      {estado === 'sem_suporte' && (
        <p className="text-sm text-slate-500">
          Este navegador não suporta notificações. No iPhone, adicione o app à tela
          inicial (Compartilhar → Adicionar à Tela de Início) e ative por lá.
        </p>
      )}

      {estado !== 'sem_suporte' && !vapidPublicKey && (
        <p className="text-sm text-slate-500">
          Notificações ainda não configuradas no servidor (defina as chaves VAPID).
        </p>
      )}

      {estado !== 'sem_suporte' && vapidPublicKey && (
        <div className="flex flex-wrap items-center gap-2">
          {estado === 'inscrito' ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Ativadas neste dispositivo
              </span>
              <button
                type="button"
                onClick={testar}
                disabled={ocupado}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Enviar teste
              </button>
              <button
                type="button"
                onClick={desativar}
                disabled={ocupado}
                className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                Desativar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={ativar}
              disabled={ocupado || estado === 'carregando'}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {ocupado ? 'Ativando…' : 'Ativar notificações'}
            </button>
          )}
        </div>
      )}

      {aviso && <p className="text-sm text-red-600">{aviso}</p>}
    </section>
  );
}
