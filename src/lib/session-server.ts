// Helpers de sessão para Server Components e Server Actions (Node).
// O proxy já bloqueia navegação, mas Server Actions são alcançáveis por POST
// direto em qualquer rota — cada action valida o papel aqui (defesa em
// profundidade, como recomenda o guia de data security do Next).

import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { SESSION_COOKIE, getPapelFromToken, type Papel } from '@/lib/session';

export async function getPapelSessao(): Promise<Papel | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getPapelFromToken(token, env.AUTH_SECRET);
}

// Qualquer usuário logado (admin ou funcionário).
export async function exigirSessao(): Promise<Papel> {
  const papel = await getPapelSessao();
  if (!papel) throw new Error('Não autorizado');
  return papel;
}

// Apenas admin — usar em toda action administrativa.
export async function exigirAdmin(): Promise<void> {
  const papel = await getPapelSessao();
  if (papel !== 'admin') throw new Error('Não autorizado');
}
