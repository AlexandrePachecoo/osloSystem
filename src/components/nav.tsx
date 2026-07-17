'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/actions/auth';
import type { Papel } from '@/lib/session';

const LINKS_ADMIN = [
  { href: '/', label: 'Painel' },
  { href: '/servicos', label: 'Serviços' },
  { href: '/lembretes', label: 'Lembretes' },
  { href: '/relatorios', label: 'Relatórios' },
  { href: '/estoque', label: 'Estoque' },
  { href: '/funcionarios', label: 'Funcionários' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/whatsapp', label: 'WhatsApp' },
];

// Funcionário (portaria) só vê a própria aba.
const LINKS_FUNCIONARIO = [{ href: '/portaria', label: 'Relatório da portaria' }];

// A raiz ('/') só casa exata; as demais abas também cobrem as subrotas
// (ex.: /servicos/123/editar continua marcando "Serviços").
function ehAtivo(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ papel }: { papel: Papel }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const links = papel === 'admin' ? LINKS_ADMIN : LINKS_FUNCIONARIO;
  const home = papel === 'admin' ? '/' : '/portaria';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href={home}
            className="shrink-0 text-lg font-semibold tracking-tight"
          >
            Oslo<span className="text-slate-400">/condomínio</span>
          </Link>
          {/* Abas horizontais no desktop */}
          <nav className="hidden gap-4 text-sm md:flex">
            {links.map((l) => {
              const ativo = ehAtivo(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={ativo ? 'page' : undefined}
                  className={`border-b-2 pb-0.5 transition-colors ${
                    ativo
                      ? 'border-slate-900 font-medium text-slate-900'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <form action={logout} className="hidden md:block">
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Sair
            </button>
          </form>
          {/* Botão de menu no mobile */}
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls="menu-mobile"
            aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 md:hidden"
          >
            {aberto ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Menu mobile expansível */}
      {aberto && (
        <nav
          id="menu-mobile"
          className="border-t border-slate-100 px-2 pb-3 md:hidden"
        >
          {links.map((l) => {
            const ativo = ehAtivo(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setAberto(false)}
                aria-current={ativo ? 'page' : undefined}
                className={`block rounded-md px-3 py-2.5 text-sm ${
                  ativo
                    ? 'bg-slate-100 font-medium text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <form action={logout} className="mt-1 border-t border-slate-100 pt-1">
            <button
              type="submit"
              className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50"
            >
              Sair
            </button>
          </form>
        </nav>
      )}
    </header>
  );
}
