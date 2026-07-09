import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { isCronAuthorized } from '@/lib/cron-auth';
import { STATUS_TERMINAIS } from '@/domain/servico-status';
import { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

const DIA_MS = 24 * 60 * 60 * 1000;

// Cron diário: gera um lembrete para cada serviço parado há mais de
// `lembreteDias` dias (por serviço; default LEMBRETE_DIAS_SEM_MUDANCA) que
// não esteja em estado terminal. Resolver um lembrete sem mudar o status
// adia o próximo aviso pelo mesmo prazo (contado do último lembrete).
//
// Idempotente: o índice parcial `lembrete_um_ativo_por_servico` garante no
// banco no máximo 1 lembrete ativo por serviço — reexecutar no mesmo dia
// (ou N vezes) não duplica nada.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const agora = Date.now();

  const candidatos = await prisma.servico.findMany({
    where: {
      status: { notIn: [...STATUS_TERMINAIS] },
      lembretes: { none: { resolvido: false } },
    },
    select: {
      id: true,
      titulo: true,
      status: true,
      statusChangedAt: true,
      lembreteDias: true,
      lembretes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const parados = candidatos.filter((servico) => {
    const dias = servico.lembreteDias ?? env.LEMBRETE_DIAS_SEM_MUDANCA;
    const limite = agora - dias * DIA_MS;
    if (servico.statusChangedAt.getTime() >= limite) return false;
    // Lembrete resolvido recentemente conta como "avisado": só avisa de novo
    // depois que o prazo do serviço passar desde o último lembrete.
    const ultimoLembrete = servico.lembretes[0];
    return !ultimoLembrete || ultimoLembrete.createdAt.getTime() < limite;
  });

  let criados = 0;
  for (const servico of parados) {
    const diasParado = Math.floor((agora - servico.statusChangedAt.getTime()) / DIA_MS);
    try {
      await prisma.lembrete.create({
        data: {
          servicoId: servico.id,
          mensagem: `Serviço "${servico.titulo}" está em "${servico.status}" há ${diasParado} dias sem mudança.`,
        },
      });
      criados += 1;
    } catch (error) {
      // P2002 = corrida com outra execução criando o mesmo lembrete ativo.
      // Ignorar mantém a rota segura para reexecução.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        continue;
      }
      throw error;
    }
  }

  return NextResponse.json({
    ok: true,
    verificados: parados.length,
    lembretesCriados: criados,
  });
}
