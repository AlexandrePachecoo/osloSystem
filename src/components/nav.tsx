import Link from 'next/link';
import { logout } from '@/actions/auth';

const LINKS = [
  { href: '/', label: 'Painel' },
  { href: '/servicos', label: 'Serviços' },
  { href: '/lembretes', label: 'Lembretes' },
  { href: '/relatorios', label: 'Relatórios' },
];

export function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Oslo<span className="text-slate-400">/condomínio</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-slate-600 hover:text-slate-900"
              >
                {l.label}
              </Link>
            ))}
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
