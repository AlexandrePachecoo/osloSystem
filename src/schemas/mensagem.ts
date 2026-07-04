import { z } from 'zod';
import { Prioridade } from '@/generated/prisma/enums';

export const mensagemIngestSchema = z.object({
  autor: z.string().trim().min(1, 'Autor é obrigatório').max(100),
  texto: z.string().trim().min(1, 'Texto é obrigatório').max(4000),
  externalId: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
});

export const atualizarRascunhoSchema = z.object({
  id: z.cuid(),
  prioridade: z.enum(Prioridade).nullable().default(null),
  rascunhoResposta: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null),
});

export const mensagemIdSchema = z.object({ id: z.cuid() });
