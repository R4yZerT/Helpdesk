// RF-05 — Guard web

import React from 'react';
import { Text, View } from 'react-native';
import type { RolUsuario } from '@helpdesk/shared';
import { hasAnyRole, type Permission, can } from '@helpdesk/shared';
import { useAuth } from '../context/AuthContext';

type Props = {
  allow: readonly RolUsuario[];
  permissions?: readonly Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function RequireRole({ allow, permissions, fallback, children }: Props) {
  const { profile, loading } = useAuth();
  if (loading) return <View style={{ padding: 24 }}><Text>Cargando…</Text></View>;
  const rol = profile?.rol ?? null;
  const roleOk = hasAnyRole(rol, allow);
  const permOk = !permissions || permissions.every((p) => can(rol, p));
  if (!roleOk || !permOk) {
    return (fallback as React.ReactElement) ?? (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ fontWeight: '700' }}>Acceso denegado</Text>
        <Text style={{ marginTop: 8, opacity: 0.7 }}>Rol {rol ?? 'sin sesión'} sin permiso.</Text>
      </View>
    );
  }
  return <>{children}</>;
}
