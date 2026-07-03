import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { gerarRelatorioSemanal } from '@/lib/gerar-relatorio';

export const dynamic = 'force-dynamic';

// Cron semanal (domingo 20h BRT): gera/atualiza o relatório da semana corrente.
// Também serve como endpoint de geração sob demanda via
// `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/relatorio-semanal`.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const relatorio = await gerarRelatorioSemanal();

  return NextResponse.json({
    ok: true,
    relatorioId: relatorio.id,
    periodoInicio: relatorio.periodoInicio,
    periodoFim: relatorio.periodoFim,
  });
}
