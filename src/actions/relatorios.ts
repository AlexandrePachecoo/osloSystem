'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { gerarRelatorioSemanal } from '@/lib/gerar-relatorio';

// Geração sob demanda a partir do painel (botão em /relatorios).
export async function gerarRelatorioAgora(): Promise<void> {
  const relatorio = await gerarRelatorioSemanal();
  revalidatePath('/relatorios');
  redirect(`/relatorios/${relatorio.id}`);
}
