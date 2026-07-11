import { z } from 'zod';

export const orcamentoCreateSchema = z.object({
  servicoId: z.cuid(),
  fornecedor: z.string().trim().min(1, 'Informe a empresa/fornecedor').max(200),
  valor: z.coerce.number().nonnegative('Valor não pode ser negativo'),
  observacoes: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
});

export const orcamentoIdSchema = z.object({
  id: z.cuid(),
  servicoId: z.cuid(),
});

export type OrcamentoCreateInput = z.infer<typeof orcamentoCreateSchema>;
