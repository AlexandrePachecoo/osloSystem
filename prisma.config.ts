import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations usam a conexão direta (porta 5432), nunca a pooled.
    url: process.env.DIRECT_URL ?? '',
  },
});
