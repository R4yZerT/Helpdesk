// RF-03 — Recovery deep-link helpdesk://reset-password#access_token=..&refresh_token=..&type=recovery
// El ForgotPassword ya envía redirectTo helpdesk://... (scheme en app.json); aquí se parsea
// el fragmento (flujo implícito, detectSessionInUrl=false) y se guardan los tokens pendientes
// para que UpdatePassword haga setSession sin que el gate de RootNavigator la desmonte antes.

export type RecoveryTokens = { accessToken: string; refreshToken: string };

function parseParams(fragment: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of fragment.split('&')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const k = part.slice(0, i);
    const raw = part.slice(i + 1);
    try {
      out[k] = decodeURIComponent(raw);
    } catch {
      out[k] = raw;
    }
  }
  return out;
}

// Extrae tokens recovery de una URL (fragmento #... o query ?... como respaldo).
export function parseRecoveryUrl(url: string): RecoveryTokens | null {
  try {
    const hash = url.split('#')[1] ?? '';
    const query = url.split('?')[1]?.split('#')[0] ?? '';
    const params = parseParams(hash || query);
    if ((params.type ?? '') !== 'recovery') return null;
    const accessToken = params.access_token ?? '';
    const refreshToken = params.refresh_token ?? '';
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

let pending: RecoveryTokens | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // Listener roto no bloquea el flujo de recovery
    }
  });
}

export function storeRecoveryTokens(t: RecoveryTokens): void {
  pending = t;
  notify();
}

export function consumeRecoveryTokens(): RecoveryTokens | null {
  const t = pending;
  pending = null;
  notify();
  return t;
}

export function clearRecoveryTokens(): void {
  pending = null;
  notify();
}

export function hasRecoveryTokens(): boolean {
  return pending !== null;
}

export function subscribeRecovery(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
