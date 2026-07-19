import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { MensagemCard, type MensagemView } from '@/components/mensagem-card';
import { SimularMensagemForm } from '@/components/simular-mensagem-form';
import { formatarData } from '@/lib/format';
import type { MensagemWhatsApp } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

function paraView(m: MensagemWhatsApp): MensagemView {
  return {
    id: m.id,
    autor: m.autor,
    textoOriginal: m.textoOriginal,
    prioridade: m.prioridade,
    rascunhoResposta: m.rascunhoResposta,
    rascunhoStatus: m.rascunhoStatus,
    recebidaEmFmt: formatarData(m.recebidaEm),
    respondidaViaAppFmt: m.respondidaViaAppEm ? formatarData(m.respondidaViaAppEm) : null,
  };
}

export default async function WhatsAppPage() {
  const mensagens = await prisma.mensagemWhatsApp.findMany({
    orderBy: { recebidaEm: 'desc' },
    take: 200,
  });

  const fila = mensagens.filter(
    (m) => m.rascunhoStatus === 'pendente' || m.rascunhoStatus === 'aprovado',
  );
  const encerradas = mensagens.filter(
    (m) => m.rascunhoStatus === 'enviado' || m.rascunhoStatus === 'descartado',
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fila de mensagens do grupo com prioridade classificada e rascunho de resposta.
          Nada é enviado automaticamente — aprovação e envio são sempre manuais.
        </p>
        <Link
          href="/whatsapp/conectar"
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          Conectar número (Coexistence) →
        </Link>
      </div>

      <SimularMensagemForm />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Fila ({fila.length})</h2>
        {fila.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma mensagem aguardando.</p>
        ) : (
          fila.map((m) => <MensagemCard key={m.id} mensagem={paraView(m)} />)
        )}
      </section>

      {encerradas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-slate-500">
            Encerradas ({encerradas.length})
          </h2>
          {encerradas.map((m) => (
            <MensagemCard key={m.id} mensagem={paraView(m)} />
          ))}
        </section>
      )}
    </div>
  );
}
