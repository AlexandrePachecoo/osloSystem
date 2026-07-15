'use server';

import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  type Papel,
} from '@/lib/session';
import type { ActionState } from '@/actions/servicos';

function senhaConfere(senha: string, esperada: string | undefined): boolean {
  if (!esperada) return false;
  const a = Buffer.from(senha);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Uma senha por papel: ADMIN_PASSWORD → admin, FUNCIONARIO_PASSWORD → funcionário.
// A senha do admin é testada primeiro (se coincidirem, prevalece o admin).
function papelDaSenha(senha: string): Papel | null {
  if (senhaConfere(senha, env.ADMIN_PASSWORD)) return 'admin';
  if (senhaConfere(senha, env.FUNCIONARIO_PASSWORD)) return 'funcionario';
  return null;
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const senha = String(formData.get('senha') ?? '');
  const papel = papelDaSenha(senha);
  if (!papel) {
    return { error: 'Senha incorreta' };
  }

  const token = await createSessionToken(env.AUTH_SECRET, papel);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(papel === 'funcionario' ? '/portaria' : '/');
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}
