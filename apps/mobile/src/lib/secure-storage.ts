// RF-04 — Adaptador SecureStore cifrado para Supabase (Calidad: Seguridad/Confidencialidad)
// Supabase auth.storage espera {getItem,setItem,removeItem}. SecureStore cifra en Keychain/Keystore.
// Fallback a memoria si no disponible (tests/web).
import * as SecureStore from 'expo-secure-store';

const memory = new Map<string, string>();

function canUseSecureStore(): boolean {
  // SecureStore no disponible en web/tests
  try { return typeof SecureStore.getItemAsync === 'function'; } catch { return false; }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!canUseSecureStore()) return memory.get(key) ?? null;
    try { return await SecureStore.getItemAsync(key); } catch { return memory.get(key) ?? null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!canUseSecureStore()) { memory.set(key, value); return; }
    try { await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); }
    catch { memory.set(key, value); }
  },
  async removeItem(key: string): Promise<void> {
    if (!canUseSecureStore()) { memory.delete(key); return; }
    try { await SecureStore.deleteItemAsync(key); } catch { memory.delete(key); }
  },
};
