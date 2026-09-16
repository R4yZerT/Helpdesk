// RF-04 + RF-05 — Sesión persistente y perfil con rol (Atributos: Seguridad + Disponibilidad + Usabilidad)
// RF-04: SecureStore (lib/supabase), idle 30m cliente+servidor, global signOut, detección cuenta desactivada/rol cambiado

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { fetchProfile, type Profile } from '@helpdesk/shared';
import { can, type Permission } from '@helpdesk/shared';
import { supabase } from '../lib/supabase';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import {
  parseRecoveryUrl,
  storeRecoveryTokens,
  clearRecoveryTokens,
  hasRecoveryTokens,
  subscribeRecovery,
} from '../lib/recovery-link';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutGlobal: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  can: (permission: Permission) => boolean;
  idleWarning: string | null;
  resetIdle: () => void;
  // RF-03 recovery: hay tokens pendientes de helpdesk://reset-password
  recoveryPending: boolean;
  clearRecovery: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idleWarning, setIdleWarning] = useState<string | null>(null);
  const [recoveryPending, setRecoveryPending] = useState(hasRecoveryTokens());

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const p = await fetchProfile(supabase, userId);
      if (p && !p.activo) {
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        const msg = 'Usuario desactivado, contacte con el administrador';
        setError(msg);
        throw new Error(msg);
      }
      setProfile(p);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando perfil';
      if (msg.includes('desactivado')) {
        setError(msg);
        setProfile(null);
      } else {
        setError(msg);
        setProfile(null);
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    // Sesión inicial
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      if (data.session?.user) {
        void loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setLoading(true);
        try { await loadProfile(newSession.user.id); } catch {}
        finally { setLoading(false); }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    setError(null);
    let email = identifier.trim().toLowerCase();
    // Si es cédula (sin @), resolver a email vía Edge Function resolve-login (paridad web)
    if (!email.includes('@')) {
      const cedula = email.replace(/\s+/g, '');
      if (!/^[0-9]{5,15}$/.test(cedula)) {
        const e = new Error('Cédula debe tener 5 a 15 dígitos');
        setError(e.message);
        throw e;
      }
      const { data, error } = await supabase.functions.invoke('resolve-login', { body: { cedula } });
      if (error || !data) {
        const msg = error?.message ?? 'No se pudo resolver la cédula';
        setError(msg);
        throw new Error(msg);
      }
      const d = data as { email?: string; error?: string };
      if (d.error || !d.email) {
        const msg = d.error ?? 'Cédula no registrada';
        setError(msg);
        throw new Error(msg);
      }
      email = d.email.toLowerCase();
    }
    const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      throw authError;
    }
    try {
      const uid = signInData.user?.id;
      if (uid) await loadProfile(uid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Usuario desactivado, contacte con el administrador';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const signOutGlobal = useCallback(async () => {
    // RF-04 — cierre global (todas las sesiones) tras cambio de contraseña / compromiso
    await supabase.auth.signOut({ scope: 'global' });
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const canCheck = useCallback(
    (permission: Permission) => can(profile?.rol ?? null, permission),
    [profile],
  );

  // RF-04 idle 30m — solo cuando hay sesión
  const handleIdleTimeout = useCallback(async () => {
    setIdleWarning(null);
    setError('Sesión cerrada por inactividad (30m)');
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const handleIdleWarning = useCallback((ms: number) => {
    setIdleWarning(`Inactividad detectada — cierre en ${Math.round(ms / 1000)}s`);
  }, []);

  const { reset: resetIdle } = useIdleTimeout({
    enabled: !!session,
    onTimeout: handleIdleTimeout,
    onWarning: handleIdleWarning,
  });

  // Limpia warning al re-activar
  useEffect(() => { if (session) setIdleWarning(null); }, [session]);

  // RF-03 — escucha deep-links helpdesk://reset-password (cold start + runtime).
  // Guarda tokens y mantiene recoveryPending para que RootNavigator no desmonte
  // el AuthNavigator antes de que UpdatePassword haga setSession.
  useEffect(() => {
    const sync = () => setRecoveryPending(hasRecoveryTokens());
    const unsub = subscribeRecovery(sync);
    sync();
    let alive = true;
    const handle = async (url: string | null) => {
      if (!url || !alive) return;
      const tokens = parseRecoveryUrl(url);
      if (!tokens) return;
      try {
        await supabase.auth.signOut();
      } catch {
        // Sin sesión previa no hay nada que cerrar
      }
      if (!alive) return;
      setProfile(null);
      setSession(null);
      storeRecoveryTokens(tokens);
    };
    Linking.getInitialURL()
      .then((u) => {
        void handle(u);
      })
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handle(url);
    });
    return () => {
      alive = false;
      unsub();
      sub.remove();
    };
  }, []);

  const clearRecovery = useCallback(() => {
    clearRecoveryTokens();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, loading, error, signIn, signOut, signOutGlobal, refreshProfile, can: canCheck, idleWarning, resetIdle, recoveryPending, clearRecovery }),
    [session, profile, loading, error, signIn, signOut, signOutGlobal, refreshProfile, canCheck, idleWarning, resetIdle, recoveryPending, clearRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

// Hook de conveniencia RF-05 — verifica rol
export function useRole() {
  const { profile, loading } = useAuth();
  return { rol: profile?.rol ?? null, loading, profile };
}
