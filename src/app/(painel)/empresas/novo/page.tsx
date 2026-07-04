import { EmpresaForm } from '@/components/empresa-form';

export default function NovaEmpresaPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova empresa</h1>
      <EmpresaForm modo="criar" />
    </div>
  );
}
