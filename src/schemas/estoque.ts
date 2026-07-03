import { z } from 'zod';

export const itemEstoqueCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(200),
  quantidade: z.coerce.number().int('Quantidade deve ser inteira').min(0),
  quantidadeMinima: z.coerce.number().int('Quantidade mínima deve ser inteira').min(0),
  unidade: z.string().trim().min(1, 'Unidade é obrigatória').max(20),
});

export const itemEstoqueUpdateSchema = itemEstoqueCreateSchema.extend({
  id: z.cuid(),
});
