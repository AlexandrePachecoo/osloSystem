import type { ServicoStatus } from '@/generated/prisma/enums';

// Máquina de estados do Servico. Função pura — sem Prisma, sem React —
// para a regra de negócio ficar testável e num lugar só.
//
//   orcamento ──► aprovado ──► em_andamento ──► feito
//       │             │
//       └──► rejeitado ◄┘   (terminal, só a partir de orcamento/aprovado)
const TRANSICOES: Record<ServicoStatus, readonly ServicoStatus[]> = {
  orcamento: ['aprovado', 'rejeitado'],
  aprovado: ['em_andamento', 'rejeitado'],
  em_andamento: ['feito'],
  feito: [],
  rejeitado: [],
};

export const STATUS_TERMINAIS: readonly ServicoStatus[] = ['feito', 'rejeitado'];

export function transicoesValidas(de: ServicoStatus): readonly ServicoStatus[] {
  return TRANSICOES[de];
}

export function podeTransicionar(de: ServicoStatus, para: ServicoStatus): boolean {
  return TRANSICOES[de].includes(para);
}

export function validarTransicao(de: ServicoStatus, para: ServicoStatus): void {
  if (!podeTransicionar(de, para)) {
    throw new TransicaoInvalidaError(de, para);
  }
}

export class TransicaoInvalidaError extends Error {
  constructor(
    public readonly de: ServicoStatus,
    public readonly para: ServicoStatus,
  ) {
    super(`Transição de status inválida: ${de} → ${para}`);
    this.name = 'TransicaoInvalidaError';
  }
}
