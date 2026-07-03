'use server';

import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from '@/lib/session';
import type { ActionState } from '@/actions/servicos';

function senhaCorreta(senha: string): boolean {
  const a = Buffer.from(senha);
  const b = Buffer.from(env.ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const senha = String(formData.get('senha') ?? '');
  if (!senhaCorreta(senha)) {
    return { error: 'Senha incorreta' };
  }

  const token = await createSessionToken(env.AUTH_SECRET);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect('/');
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}
