import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ServicoForm } from '@/components/servico-form';

export const dynamic = 'force-dynamic';

export default async function EditarServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [servico, empresas] = await Promise.all([
    prisma.servico.findUnique({ where: { id } }),
    prisma.empresa.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ]);
  if (!servico) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/servicos/${id}`} className="text-sm text-slate-500 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Editar serviço</h1>
      </div>
      <ServicoForm
        modo="editar"
        empresas={empresas}
        defaults={{
          id: servico.id,
          titulo: servico.titulo,
          descricao: servico.descricao ?? undefined,
          valorOrcamento: servico.valorOrcamento?.toString(),
          prioridade: servico.prioridade,
          empresaId: servico.empresaId ?? undefined,
          empresaNome: servico.empresaNome ?? undefined,
          lembreteDias: servico.lembreteDias?.toString(),
        }}
      />
    </div>
  );
}
