import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { isCronAuthorized } from '@/lib/cron-auth';
import { STATUS_TERMINAIS } from '@/domain/servico-status';
import { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

// Cron diário: gera um lembrete para cada serviço parado há mais de
// LEMBRETE_DIAS_SEM_MUDANCA dias (default 5) que não esteja em estado terminal.
//
// Idempotente: o índice parcial `lembrete_um_ativo_por_servico` garante no
// banco no máximo 1 lembrete ativo por serviço — reexecutar no mesmo dia
// (ou N vezes) não duplica nada.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dias = env.LEMBRETE_DIAS_SEM_MUDANCA;
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const parados = await prisma.servico.findMany({
    where: {
      status: { notIn: [...STATUS_TERMINAIS] },
      statusChangedAt: { lt: limite },
      lembretes: { none: { resolvido: false } },
    },
    select: { id: true, titulo: true, status: true, statusChangedAt: true },
  });

  let criados = 0;
  for (const servico of parados) {
    const diasParado = Math.floor(
      (Date.now() - servico.statusChangedAt.getTime()) / (24 * 60 * 60 * 1000),
    );
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
