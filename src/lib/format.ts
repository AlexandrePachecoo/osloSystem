import type { Prioridade, ServicoStatus } from '@/generated/prisma/enums';

export const STATUS_LABEL: Record<ServicoStatus, string> = {
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  em_andamento: 'Em andamento',
  feito: 'Feito',
  rejeitado: 'Rejeitado',
};

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const STATUS_ORDEM: readonly ServicoStatus[] = [
  'orcamento',
  'aprovado',
  'em_andamento',
  'feito',
  'rejeitado',
];

export function formatarMoeda(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(valor),
  );
}

export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(data);
}
