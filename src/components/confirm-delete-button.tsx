'use client';

export function ConfirmDeleteButton({
  action,
  id,
  mensagem,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  mensagem: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(mensagem)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-red-600 hover:underline">
        Excluir
      </button>
    </form>
  );
}
