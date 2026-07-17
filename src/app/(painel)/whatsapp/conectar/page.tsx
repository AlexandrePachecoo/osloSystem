import Link from 'next/link';
import { env } from '@/lib/env';
import { ConectarWhatsAppForm } from '@/components/conectar-whatsapp-form';

export const dynamic = 'force-dynamic';

// Conexão do número via WhatsApp Coexistence: o mesmo número segue no app
// WhatsApp Business do celular (grupos, chamadas e conversas continuam lá) e
// passa a valer também na Cloud API — as DMs 1:1 chegam à fila pelo webhook.
// Grupos NÃO sincronizam com a API: seguem funcionando só no app.
export default function ConectarWhatsAppPage() {
  const configurado = Boolean(
    env.NEXT_PUBLIC_META_APP_ID && env.NEXT_PUBLIC_WHATSAPP_ES_CONFIG_ID,
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Conectar número do WhatsApp</h1>
        <p className="mt-1 text-sm text-slate-500">
          Coexistence: vincula o número à API oficial da Meta <em>sem tirá-lo do
          celular</em>. Grupos, chamadas e conversas continuam funcionando
          normalmente no app WhatsApp Business; as conversas individuais passam a
          aparecer também na fila daqui. Mensagens de grupo não sincronizam com o
          sistema — seguem só no app.
        </p>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>O número precisa estar no app <strong>WhatsApp Business</strong> (não no WhatsApp comum), atualizado.</li>
        <li>Durante o fluxo a Meta mostra um QR code — escaneie com o app Business do celular do número.</li>
        <li>Ao final, o token e os IDs aparecem aqui para você colocar nas variáveis de ambiente.</li>
      </ul>

      {configurado ? (
        <ConectarWhatsAppForm
          appId={env.NEXT_PUBLIC_META_APP_ID!}
          configId={env.NEXT_PUBLIC_WHATSAPP_ES_CONFIG_ID!}
          graphVersion={env.WHATSAPP_GRAPH_VERSION}
        />
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Antes de conectar, preencha <code>NEXT_PUBLIC_META_APP_ID</code> e{' '}
          <code>NEXT_PUBLIC_WHATSAPP_ES_CONFIG_ID</code> (e{' '}
          <code>WHATSAPP_APP_SECRET</code>) no ambiente — veja a seção
          “WhatsApp Coexistence” do <code>.env.example</code> e do README.
        </p>
      )}

      <Link href="/whatsapp" className="inline-block text-sm text-blue-600 hover:underline">
        ← Voltar para a fila
      </Link>
    </div>
  );
}
