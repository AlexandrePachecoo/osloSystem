import { FuncionarioForm } from '@/components/funcionario-form';

export default function NovoFuncionarioPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo funcionário</h1>
      <FuncionarioForm modo="criar" />
    </div>
  );
}
