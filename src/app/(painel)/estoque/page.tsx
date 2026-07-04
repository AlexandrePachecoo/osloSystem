import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { excluirItemEstoque } from '@/actions/estoque';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';

export const dynamic = 'force-dynamic';

export default async function EstoquePage() {
  const itens = await prisma.itemEstoque.findMany({ orderBy: { nome: 'asc' } });
  const abaixoMinimo = itens.filter((i) => i.quantidade < i.quantidadeMinima).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Estoque</h1>
        <Link
          href="/estoque/novo"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Novo item
        </Link>
      </div>

      {abaixoMinimo > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {abaixoMinimo === 1
            ? '1 item está abaixo da quantidade mínima.'
            : `${abaixoMinimo} itens estão abaixo da quantidade mínima.`}
        </div>
      )}

      {itens.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum item cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Quantidade</th>
                <th className="px-4 py-3">Mínimo</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((item) => {
                const abaixo = item.quantidade < item.quantidadeMinima;
                return (
                  <tr key={item.id} className={abaixo ? 'bg-red-50' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-medium">{item.nome}</td>
                    <td className="px-4 py-3">
                      {item.quantidade} {item.unidade}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.quantidadeMinima} {item.unidade}
                    </td>
                    <td className="px-4 py-3">
                      {abaixo ? (
                        <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                          Abaixo do mínimo
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-4">
                        <Link
                          href={`/estoque/${item.id}/editar`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Editar
                        </Link>
                        <ConfirmDeleteButton
                          action={excluirItemEstoque}
                          id={item.id}
                          mensagem={`Excluir o item "${item.nome}"?`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
