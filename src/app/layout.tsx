import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oslo — Administração do Condomínio',
  description: 'Painel de administração do condomínio',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
