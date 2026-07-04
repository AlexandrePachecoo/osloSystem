import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { EmpresaForm } from '@/components/empresa-form';

export const dynamic = 'force-dynamic';

export default async function EditarEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const empresa = await prisma.empresa.findUnique({ where: { id } });
  if (!empresa) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/empresas" className="text-sm text-slate-500 hover:underline">
          ← Empresas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Editar empresa</h1>
      </div>
      <EmpresaForm
        modo="editar"
        defaults={{
          id: empresa.id,
          nome: empresa.nome,
          contato: empresa.contato ?? undefined,
          categoria: empresa.categoria ?? undefined,
          observacoes: empresa.observacoes ?? undefined,
        }}
      />
    </div>
  );
}
