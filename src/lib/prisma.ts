import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';

// Singleton serverless-safe: em dev o hot-reload recriaria o client a cada
// alteração; em produção (Vercel) cada lambda reusa a instância entre
// invocações quentes. A conexão usa a URL pooled do Supabase (Supavisor).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Supavisor em transaction mode: manter o pool local pequeno —
  // cada lambda precisa de poucas conexões e o pooling real é do Supabase.
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: 3 });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
