import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { excluirEmpresa } from '@/actions/empresas';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';

export const dynamic = 'force-dynamic';

export default async function EmpresasPage() {
  const empresas = await prisma.empresa.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { servicos: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empresas</h1>
        <Link
          href="/empresas/novo"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nova empresa
        </Link>
      </div>

      {empresas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma empresa cadastrada.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Serviços</th>
                <th className="px-4 py-3">Observações</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empresas.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{e.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{e.categoria ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{e.contato ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{e._count.servicos}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-500">
                    {e.observacoes ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/empresas/${e.id}/editar`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Editar
                      </Link>
                      <ConfirmDeleteButton
                        action={excluirEmpresa}
                        id={e.id}
                        mensagem={`Excluir a empresa "${e.nome}"? Os serviços vinculados são mantidos (ficam sem empresa).`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
