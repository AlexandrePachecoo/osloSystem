import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { FuncionarioForm } from '@/components/funcionario-form';

export const dynamic = 'force-dynamic';

export default async function EditarFuncionarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const funcionario = await prisma.funcionario.findUnique({ where: { id } });
  if (!funcionario) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/funcionarios" className="text-sm text-slate-500 hover:underline">
          ← Funcionários
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Editar funcionário</h1>
      </div>
      <FuncionarioForm
        modo="editar"
        defaults={{
          id: funcionario.id,
          nome: funcionario.nome,
          funcao: funcionario.funcao,
          contato: funcionario.contato ?? undefined,
          status: funcionario.status,
        }}
      />
    </div>
  );
}
