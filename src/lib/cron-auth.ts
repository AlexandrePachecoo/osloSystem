import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

// O Vercel Cron envia `Authorization: Bearer ${CRON_SECRET}` automaticamente
// quando a env CRON_SECRET está definida no projeto. Para disparo manual,
// basta enviar o mesmo header.
export function isCronAuthorized(request: Request): boolean {
  const header = request.headers.get('authorization');
  if (!header) return false;
  const expected = `Bearer ${env.CRON_SECRET}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
