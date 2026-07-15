import { Nav } from '@/components/nav';
import { getPapelSessao } from '@/lib/session-server';

export default async function PainelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // O proxy garante sessão válida antes de chegar aqui; o papel só decide o nav.
  const papel = (await getPapelSessao()) ?? 'funcionario';
  return (
    <>
      <Nav papel={papel} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
