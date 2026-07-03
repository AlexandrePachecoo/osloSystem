import { z } from 'zod';

// Valida as variáveis de ambiente uma única vez, no primeiro import.
// Falha cedo (no boot da rota/página) com mensagem clara em vez de
// quebrar em runtime no meio de uma query.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória (URL pooled do Supabase)'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET deve ter pelo menos 16 caracteres'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD deve ter pelo menos 8 caracteres'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET deve ter pelo menos 16 caracteres'),
  LEMBRETE_DIAS_SEM_MUDANCA: z.coerce.number().int().positive().default(5),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  CRON_SECRET: process.env.CRON_SECRET,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  AUTH_SECRET: process.env.AUTH_SECRET,
  LEMBRETE_DIAS_SEM_MUDANCA: process.env.LEMBRETE_DIAS_SEM_MUDANCA,
});
