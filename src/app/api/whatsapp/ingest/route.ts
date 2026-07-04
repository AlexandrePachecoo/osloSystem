import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { processarMensagemRecebida } from '@/lib/whatsapp/pipeline';
import { mensagemIngestSchema } from '@/schemas/mensagem';

export const dynamic = 'force-dynamic';

// Entrada HTTP de mensagens (hoje alimentada manualmente; no futuro, o
// webhook do provider real normaliza o payload e reusa o mesmo pipeline).
// Protegida pelo mesmo Bearer CRON_SECRET das rotas de cron:
//
//   curl -X POST /api/whatsapp/ingest \
//     -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
//     -d '{"autor":"Maria 302","texto":"Tem um vazamento na garagem","externalId":"wamid.123"}'
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = mensagemIngestSchema.safeParse(corpo);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { mensagem, duplicada } = await processarMensagemRecebida({
    autor: parsed.data.autor,
    texto: parsed.data.texto,
    externalId: parsed.data.externalId,
  });

  return NextResponse.json(
    {
      ok: true,
      duplicada,
      mensagemId: mensagem.id,
      prioridade: mensagem.prioridade,
      temRascunho: mensagem.rascunhoResposta !== null,
    },
    { status: duplicada ? 200 : 201 },
  );
}
