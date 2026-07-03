'use client';

import { excluirServico } from '@/actions/servicos';

export function DeleteServicoButton({ id }: { id: string }) {
  return (
    <form
      action={excluirServico}
      onSubmit={(e) => {
        if (!confirm('Excluir este serviço? Essa ação não pode ser desfeita.')) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-red-600 hover:underline">
        Excluir
      </button>
    </form>
  );
}
