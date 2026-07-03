// Sessão do admin (usuário único): o cookie carrega um token HMAC derivado
// do AUTH_SECRET. Sem tabela de sessões — invalidar = trocar o AUTH_SECRET.
// Usa Web Crypto para funcionar tanto no proxy (edge) quanto em Node.

export const SESSION_COOKIE = 'oslo_session';
const SESSION_PAYLOAD = 'oslo-admin-session-v1';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export async function createSessionToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(SESSION_PAYLOAD));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isValidSessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;
  const expected = await createSessionToken(secret);
  if (token.length !== expected.length) return false;
  // comparação em tempo constante
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
