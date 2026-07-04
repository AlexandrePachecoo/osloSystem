import { EstoqueForm } from '@/components/estoque-form';

export default function NovoItemEstoquePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo item de estoque</h1>
      <EstoqueForm modo="criar" />
    </div>
  );
}
