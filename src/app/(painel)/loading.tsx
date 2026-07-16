// Fallback de navegação do painel.
//
// As páginas são `force-dynamic` e fazem queries no banco, então sem este
// arquivo o App Router segura a página atual até a próxima terminar de
// renderizar no servidor — é a "travadinha" ao clicar numa aba. Com um
// loading.tsx no grupo de rotas, a transição é instantânea: o esqueleto
// aparece na hora via Suspense enquanto os dados chegam.
export default function CarregandoPainel() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="h-8 w-48 rounded-md bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 rounded-lg bg-slate-200" />
        <div className="h-24 rounded-lg bg-slate-200" />
        <div className="h-24 rounded-lg bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-5/6 rounded bg-slate-200" />
        <div className="h-4 w-2/3 rounded bg-slate-200" />
      </div>
    </div>
  );
}
