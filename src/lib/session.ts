// Sessão com dois papéis (admin e funcionário): o cookie carrega
// `<papel>.<hmac>`, com HMAC derivado do AUTH_SECRET sobre payload+papel.
// Sem tabela de sessões — invalidar = trocar o AUTH_SECRET.
// Usa Web Crypto para funcionar tanto no proxy (edge) quanto em Node.

export const SESSION_COOKIE = 'oslo_session';
const SESSION_PAYLOAD = 'oslo-session-v2';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export const PAPEIS = ['admin', 'funcionario'] as const;
export type Papel = (typeof PAPEIS)[number];

async function assinar(secret: string, papel: Papel): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${SESSION_PAYLOAD}:${papel}`),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSessionToken(secret: string, papel: Papel): Promise<string> {
  return `${papel}.${await assinar(secret, papel)}`;
}

// Papel da sessão, ou null se o token for ausente/inválido.
export async function getPapelFromToken(
  token: string | undefined,
  secret: string,
): Promise<Papel | null> {
  if (!token) return null;
  const ponto = token.indexOf('.');
  if (ponto < 0) return null;
  const papel = token.slice(0, ponto) as Papel;
  if (!PAPEIS.includes(papel)) return null;

  const assinatura = token.slice(ponto + 1);
  const esperada = await assinar(secret, papel);
  if (assinatura.length !== esperada.length) return null;
  // comparação em tempo constante
  let diff = 0;
  for (let i = 0; i < esperada.length; i++) {
    diff |= assinatura.charCodeAt(i) ^ esperada.charCodeAt(i);
  }
  return diff === 0 ? papel : null;
}
