import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, getPapelFromToken } from '@/lib/session';

// Protege todo o painel. Fora da proteção:
// - /login (página + action de login)
// - /api/cron/* e /api/whatsapp/ingest (protegidas por CRON_SECRET na própria rota)
// - /api/whatsapp/webhook (protegida por verify_token no GET e assinatura no POST)
//
// Papéis: admin acessa tudo; funcionário só a portaria (/portaria e
// /api/portaria/*) — qualquer outra rota o redireciona para lá.
// Server Actions administrativas revalidam o papel internamente
// (src/lib/session-server.ts), então isto é só a camada de navegação.

function rotaDaPortaria(pathname: string): boolean {
  return (
    pathname === '/portaria' ||
    pathname.startsWith('/portaria/') ||
    pathname.startsWith('/api/portaria/')
  );
}

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
  const papel = secret ? await getPapelFromToken(token, secret) : null;

  if (!papel) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (papel === 'funcionario' && !rotaDaPortaria(pathname)) {
    return NextResponse.redirect(new URL('/portaria', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Tudo exceto assets estáticos do Next
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico)$).*)'],
};
