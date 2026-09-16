// RF-04 + RF-05 — Provider web (idéntico a mobile, sin RN deps)

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchProfile, type Profile, can, type Permission } from '@helpdesk/shared';
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
      // si ya es el mensaje de desactivado, no sobreescribir con genérico
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
    // Si es cédula (sin @), resolver a email vía Edge Function resolve-login
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
    // Verificar activo inmediato tras login — si desactivado cerrar sesión y mostrar error claro
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
    // RF-04 — cierre global (todas las sesiones) tras cambio de contraseña / compromiso (paridad mobile)
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

  // RF-04 idle 30m — solo cuando hay sesión (paridad mobile)
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

  const value = useMemo(
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

export function useRole() {
  const { profile, loading } = useAuth();
  return { rol: profile?.rol ?? null, loading, profile };
}
