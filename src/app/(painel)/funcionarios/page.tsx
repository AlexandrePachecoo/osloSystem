import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { excluirFuncionario } from '@/actions/funcionarios';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';

export const dynamic = 'force-dynamic';

export default async function FuncionariosPage() {
  const funcionarios = await prisma.funcionario.findMany({
    orderBy: [{ status: 'asc' }, { nome: 'asc' }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Funcionários</h1>
        <Link
          href="/funcionarios/novo"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Novo funcionário
        </Link>
      </div>

      {funcionarios.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum funcionário cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Função</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {funcionarios.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{f.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{f.funcao}</td>
                  <td className="px-4 py-3 text-slate-600">{f.contato ?? '—'}</td>
                  <td className="px-4 py-3">
                    {f.status === 'ativo' ? (
                      <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/funcionarios/${f.id}/editar`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Editar
                      </Link>
                      <ConfirmDeleteButton
                        action={excluirFuncionario}
                        id={f.id}
                        mensagem={`Excluir o funcionário "${f.nome}"? Para desligamento, prefira marcar como inativo.`}
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
