import { z } from 'zod';

// Valida as variáveis de ambiente uma única vez, no primeiro import.
// Falha cedo (no boot da rota/página) com mensagem clara em vez de
// quebrar em runtime no meio de uma query.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória (URL pooled do Supabase)'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET deve ter pelo menos 16 caracteres'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD deve ter pelo menos 8 caracteres'),
  // Opcional: sem ela, o login de funcionário (portaria) fica desativado.
  FUNCIONARIO_PASSWORD: z
    .string()
    .min(8, 'FUNCIONARIO_PASSWORD deve ter pelo menos 8 caracteres')
    .optional(),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET deve ter pelo menos 16 caracteres'),
  LEMBRETE_DIAS_SEM_MUDANCA: z.coerce.number().int().positive().default(5),
  // Fase 4 — opcionais: sem a key, mensagens entram na fila sem classificação
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  // Fase 6 — WhatsApp real (Meta Cloud API). Todas opcionais: sem elas o
  // canal cai no provider mock (só loga) e o app continua bootando normal.
  WHATSAPP_PROVIDER: z.enum(['mock', 'meta']).default('mock'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().default('v21.0'),
  // Coexistence (Embedded Signup) — opcionais: sem elas a página
  // /whatsapp/conectar apenas explica o que falta configurar.
  // NEXT_PUBLIC_* porque o FB JS SDK roda no navegador; o app id também é
  // usado no servidor como client_id na troca do code por token.
  NEXT_PUBLIC_META_APP_ID: z.string().optional(),
  NEXT_PUBLIC_WHATSAPP_ES_CONFIG_ID: z.string().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  CRON_SECRET: process.env.CRON_SECRET,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  FUNCIONARIO_PASSWORD: process.env.FUNCIONARIO_PASSWORD || undefined,
  AUTH_SECRET: process.env.AUTH_SECRET,
  LEMBRETE_DIAS_SEM_MUDANCA: process.env.LEMBRETE_DIAS_SEM_MUDANCA,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
  WHATSAPP_GRAPH_VERSION: process.env.WHATSAPP_GRAPH_VERSION,
  NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID,
  NEXT_PUBLIC_WHATSAPP_ES_CONFIG_ID: process.env.NEXT_PUBLIC_WHATSAPP_ES_CONFIG_ID,
});
