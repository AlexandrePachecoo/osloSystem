'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { movimentarEstoque } from '@/actions/estoque';

export type ItemEstoqueResumo = {
  id: string;
  nome: string;
  quantidade: number;
  quantidadeMinima: number;
  unidade: string;
};

// Widget do painel: busca um item pelo nome e adiciona/retira unidades sem
// sair do dashboard. A lista chega do server component; após a action o
// revalidatePath('/') atualiza as quantidades.
export function EstoqueRapido({ itens }: { itens: ItemEstoqueResumo[] }) {
  const [busca, setBusca] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtrados = busca.trim()
    ? itens.filter((i) => i.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : itens;
  const visiveis = filtrados.slice(0, 5);

  function movimentar(id: string, tipo: 'adicionar' | 'retirar') {
    const formData = new FormData();
    formData.set('id', id);
    formData.set('quantidade', quantidades[id] || '1');
    formData.set('tipo', tipo);
    startTransition(async () => {
      const resultado = await movimentarEstoque({ error: null }, formData);
      setErro(resultado.error);
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">Estoque rápido</h2>
        <Link href="/estoque" className="text-xs text-blue-600 hover:underline">
          ver estoque
        </Link>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar item… ex.: lâmpada"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {itens.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum item cadastrado.{' '}
          <Link href="/estoque/novo" className="text-blue-600 hover:underline">
            Cadastrar item
          </Link>
        </p>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum item encontrado para “{busca}”.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visiveis.map((item) => {
            const abaixo = item.quantidade < item.quantidadeMinima;
            return (
              <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{item.nome}</span>
                  <span className={`ml-2 text-xs ${abaixo ? 'text-red-600' : 'text-slate-500'}`}>
                    {item.quantidade} {item.unidade}
                    {abaixo && ' — abaixo do mínimo'}
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantidades[item.id] ?? '1'}
                  onChange={(e) =>
                    setQuantidades((q) => ({ ...q, [item.id]: e.target.value }))
                  }
                  aria-label={`Quantidade de ${item.nome}`}
                  className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => movimentar(item.id, 'adicionar')}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  + Adicionar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => movimentar(item.id, 'retirar')}
                  className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  − Retirar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
