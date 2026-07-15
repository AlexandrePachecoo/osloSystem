'use client';

import { useActionState } from 'react';
import { login } from '@/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, { error: null });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        action={action}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold">
          Oslo<span className="text-slate-400">/condomínio</span>
        </h1>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Senha (administração ou portaria)</span>
          <input
            type="password"
            name="senha"
            required
            autoFocus
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
