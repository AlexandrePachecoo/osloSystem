import { z } from 'zod';

const opcional = z
  .string()
  .trim()
  .max(500)
  .transform((v: string) => (v === '' ? null : v))
  .nullable()
  .default(null);

export const empresaCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(200),
  contato: opcional,
  categoria: opcional,
  observacoes: opcional,
});

export const empresaUpdateSchema = empresaCreateSchema.extend({
  id: z.cuid(),
});
