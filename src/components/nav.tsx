'use client';

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
  const links = papel === 'admin' ? LINKS_ADMIN : LINKS_FUNCIONARIO;
  const home = papel === 'admin' ? '/' : '/portaria';

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href={home} className="text-lg font-semibold tracking-tight">
            Oslo<span className="text-slate-400">/condomínio</span>
          </Link>
          <nav className="flex gap-4 text-sm">
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
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
