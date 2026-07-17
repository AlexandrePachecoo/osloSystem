import type { MetadataRoute } from 'next';

// Web App Manifest — permite instalar o painel na tela inicial do celular
// (experiência app-like) e habilita as notificações Web Push do PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Oslo — Administração do Condomínio',
    short_name: 'Oslo',
    description: 'Painel de administração do condomínio',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#0f172a',
    lang: 'pt-BR',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
