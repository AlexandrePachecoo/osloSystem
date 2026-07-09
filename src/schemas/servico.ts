import { z } from 'zod';
import { Prioridade, ServicoStatus } from '@/generated/prisma/enums';

export const prioridadeSchema = z.enum(Prioridade);
export const servicoStatusSchema = z.enum(ServicoStatus);

export const servicoCreateSchema = z.object({
  titulo: z.string().trim().min(1, 'Título é obrigatório').max(200),
  descricao: z
    .string()
    .trim()
    .max(5000)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
  valorOrcamento: z.coerce
    .number()
    .nonnegative('Valor não pode ser negativo')
    .nullable()
    .default(null),
  prioridade: prioridadeSchema.default('media'),
  empresaId: z
    .string()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
  // Empresa não cadastrada (texto livre) — para orçamentos avulsos.
  empresaNome: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
  // Dias sem mudança de status até avisar de novo (null = default global).
  lembreteDias: z.coerce
    .number()
    .int('Use um número inteiro de dias')
    .positive('Dias deve ser maior que zero')
    .max(365)
    .nullable()
    .default(null),
});

export const servicoUpdateSchema = servicoCreateSchema.extend({
  id: z.cuid(),
});

export const mudarStatusSchema = z.object({
  id: z.cuid(),
  paraStatus: servicoStatusSchema,
});

export type ServicoCreateInput = z.infer<typeof servicoCreateSchema>;
export type ServicoUpdateInput = z.infer<typeof servicoUpdateSchema>;
