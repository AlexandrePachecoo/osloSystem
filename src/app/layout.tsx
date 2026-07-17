import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oslo — Administração do Condomínio',
  description: 'Painel de administração do condomínio',
  applicationName: 'Oslo',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Oslo',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  verification: {
    other: {
      'facebook-domain-verification': 'f5boczzt3g0z04x7eewzrsewc6nne4',
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  // Deixa o app usar a área da barra de status em iOS quando instalado.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
