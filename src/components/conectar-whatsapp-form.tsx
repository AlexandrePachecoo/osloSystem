'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Embedded Signup da Meta em modo Coexistence ("Onboarding WhatsApp Business
// app users"): abre o popup oficial com featureType
// whatsapp_business_app_onboarding, no qual o dono escaneia um QR com o app
// WhatsApp Business — o número entra na Cloud API SEM sair do celular.
//
// Duas coisas chegam por caminhos diferentes e em qualquer ordem:
//   - phone_number_id/waba_id: via postMessage (type WA_EMBEDDED_SIGNUP);
//   - code (troca por token): no callback do FB.login.
// Guardamos os IDs num ref e finalizamos quando o code chega, mandando tudo
// para /api/whatsapp/onboarding (a troca usa o App Secret, só no servidor).

type FBLoginResponse = { authResponse?: { code?: string } | null };
type FBApi = {
  init(opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(
    cb: (response: FBLoginResponse) => void,
    opts: {
      config_id: string;
      response_type: string;
      override_default_response_type: boolean;
      extras: { setup: object; featureType: string; sessionInfoVersion: string };
    },
  ): void;
};

declare global {
  interface Window {
    FB?: FBApi;
    fbAsyncInit?: () => void;
  }
}

type Resultado = {
  accessToken: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  avisoWebhook: string | null;
};

export function ConectarWhatsAppForm({
  appId,
  configId,
  graphVersion,
}: {
  appId: string;
  configId: string;
  graphVersion: string;
}) {
  const [sdkPronto, setSdkPronto] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // IDs do postMessage, lidos quando o code chegar (ordem imprevisível).
  const sessionInfo = useRef<{ phoneNumberId?: string; wabaId?: string }>({});

  useEffect(() => {
    // SDK já carregado (navegação de volta à página): só (re)inicializa.
    const init = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: true, version: graphVersion });
      setSdkPronto(true);
    };
    if (window.FB) {
      init();
    } else {
      window.fbAsyncInit = init;
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }

    // Session info do popup do Embedded Signup.
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data as string) as {
          type?: string;
          event?: string;
          data?: { phone_number_id?: string; waba_id?: string; error_message?: string };
        };
        if (data.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data.event === 'ERROR') {
          setErro(data.data?.error_message ?? 'Erro no fluxo da Meta.');
          return;
        }
        // FINISH* traz os IDs; CANCEL é ignorado (usuário fechou o popup).
        if (data.data?.phone_number_id) sessionInfo.current.phoneNumberId = data.data.phone_number_id;
        if (data.data?.waba_id) sessionInfo.current.wabaId = data.data.waba_id;
      } catch {
        // mensagens de outros widgets do FB não são JSON — ignora
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [appId, graphVersion]);

  const finalizar = useCallback(async (code: string) => {
    setProcessando(true);
    setErro(null);
    try {
      const res = await fetch('/api/whatsapp/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          phoneNumberId: sessionInfo.current.phoneNumberId,
          wabaId: sessionInfo.current.wabaId,
        }),
      });
      const body = (await res.json()) as Resultado & { error?: string };
      if (!res.ok) {
        setErro(body.error ?? `Falha ao finalizar (HTTP ${res.status}).`);
        return;
      }
      setResultado(body);
    } catch {
      setErro('Falha de rede ao finalizar a conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }, []);

  const conectar = () => {
    setErro(null);
    window.FB?.login(
      (response) => {
        const code = response.authResponse?.code;
        if (code) {
          void finalizar(code);
        } else {
          setErro('Fluxo cancelado ou sem autorização — nenhum código recebido.');
        }
      },
      {
        config_id: configId,
        response_type: 'code', // code de uso único, trocado por token no servidor
        override_default_response_type: true,
        extras: {
          setup: {},
          // Modo Coexistence: onboarding de número que já vive no app Business
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      },
    );
  };

  if (resultado) {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-800">
          Número conectado! Copie os valores abaixo para as variáveis de ambiente e
          faça o redeploy — o token não será mostrado de novo.
        </p>
        <pre className="overflow-x-auto rounded-md bg-white p-3 text-xs text-slate-700">
          {`WHATSAPP_PROVIDER="meta"\nWHATSAPP_ACCESS_TOKEN="${resultado.accessToken}"\nWHATSAPP_PHONE_NUMBER_ID="${resultado.phoneNumberId ?? '<veja no painel da Meta>'}"`}
        </pre>
        {resultado.wabaId && (
          <p className="text-xs text-slate-500">WABA ID (para referência): {resultado.wabaId}</p>
        )}
        {resultado.avisoWebhook && (
          <p className="text-sm text-amber-700">{resultado.avisoWebhook}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={conectar}
        disabled={!sdkPronto || processando}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {processando
          ? 'Finalizando conexão…'
          : sdkPronto
            ? 'Conectar com a Meta'
            : 'Carregando SDK da Meta…'}
      </button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
