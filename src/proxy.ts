import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, isValidSessionToken } from '@/lib/session';

// Protege todo o painel. Fora da proteção:
// - /login (página + action de login)
// - /api/cron/* e /api/whatsapp/ingest (protegidas por CRON_SECRET na própria rota)
// - /api/whatsapp/webhook (protegida por verify_token no GET e assinatura no POST)
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/login' ||
    pathname.startsWith('/api/cron/') ||
    pathname === '/api/whatsapp/ingest' ||
    pathname === '/api/whatsapp/webhook'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET ?? '';
  if (secret && (await isValidSessionToken(token, secret))) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Tudo exceto assets estáticos do Next
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico)$).*)'],
};
