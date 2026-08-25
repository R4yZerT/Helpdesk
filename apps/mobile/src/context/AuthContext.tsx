// RF-04 + RF-05 — Sesión persistente y perfil con rol (Atributos: Seguridad + Disponibilidad + Usabilidad)
// RF-04: SecureStore (lib/supabase), idle 30m cliente+servidor, global signOut, detección cuenta desactivada/rol cambiado

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchProfile, type Profile } from '@helpdesk/shared';
import { can, type Permission } from '@helpdesk/shared';
import { supabase } from '../lib/supabase';
import { useIdleTimeout } from '../hooks/useIdleTimeout';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutGlobal: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  can: (permission: Permission) => boolean;
  idleWarning: string | null;
  resetIdle: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idleWarning, setIdleWarning] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const p = await fetchProfile(supabase, userId);
      setProfile(p);
      if (p && !p.activo) {
        setError('Cuenta desactivada');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando perfil');
      setProfile(null);
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
        await loadProfile(newSession.user.id);
        setLoading(false);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      throw authError;
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

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, loading, error, signIn, signOut, signOutGlobal, refreshProfile, can: canCheck, idleWarning, resetIdle }),
    [session, profile, loading, error, signIn, signOut, signOutGlobal, refreshProfile, canCheck, idleWarning, resetIdle],
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
