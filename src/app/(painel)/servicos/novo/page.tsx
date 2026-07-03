import { prisma } from '@/lib/prisma';
import { ServicoForm } from '@/components/servico-form';

export const dynamic = 'force-dynamic';

export default async function NovoServicoPage() {
  const empresas = await prisma.empresa.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo serviço</h1>
      <ServicoForm modo="criar" empresas={empresas} />
    </div>
  );
}
