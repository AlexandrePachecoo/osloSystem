import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { EstoqueForm } from '@/components/estoque-form';

export const dynamic = 'force-dynamic';

export default async function EditarItemEstoquePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.itemEstoque.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/estoque" className="text-sm text-slate-500 hover:underline">
          ← Estoque
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Editar item</h1>
      </div>
      <EstoqueForm
        modo="editar"
        defaults={{
          id: item.id,
          nome: item.nome,
          quantidade: item.quantidade,
          quantidadeMinima: item.quantidadeMinima,
          unidade: item.unidade,
        }}
      />
    </div>
  );
}
