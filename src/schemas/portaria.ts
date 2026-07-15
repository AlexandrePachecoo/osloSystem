import { z } from 'zod';

export const ocorrenciaCreateSchema = z.object({
  colaborador: z.string().trim().min(1, 'Informe o nome do colaborador').max(120),
  texto: z.string().trim().min(1, 'Descreva a ocorrência').max(4000),
});

export const encomendaCreateSchema = z
  .object({
    colaborador: z.string().trim().min(1, 'Informe o nome do colaborador').max(120),
    apto: z.string().trim().min(1, 'Informe o apartamento').max(20),
    descricao: z.string().trim().min(1, 'Descreva a encomenda').max(500),
    tipo: z.enum(['interna', 'externa']),
    retiradaPor: z
      .string()
      .trim()
      .max(120)
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .default(null),
  })
  .superRefine((val, ctx) => {
    // Retirada externa sem saber quem retira não serve para a portaria.
    if (val.tipo === 'externa' && !val.retiradaPor) {
      ctx.addIssue({
        code: 'custom',
        message: 'Retirada externa: informe o nome de quem vai retirar',
        path: ['retiradaPor'],
      });
    }
  })
  // Interna: quem recebe é o próprio morador — não guarda nome de retirada.
  .transform((val) => (val.tipo === 'interna' ? { ...val, retiradaPor: null } : val));

export const enviarRelatorioSchema = z.object({
  colaborador: z.string().trim().min(1, 'Informe o nome do colaborador').max(120),
});
