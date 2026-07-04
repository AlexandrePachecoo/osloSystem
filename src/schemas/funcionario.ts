import { z } from 'zod';
import { FuncionarioStatus } from '@/generated/prisma/enums';

export const funcionarioCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(200),
  funcao: z.string().trim().min(1, 'Função é obrigatória').max(100),
  contato: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
  status: z.enum(FuncionarioStatus).default('ativo'),
});

export const funcionarioUpdateSchema = funcionarioCreateSchema.extend({
  id: z.cuid(),
});
