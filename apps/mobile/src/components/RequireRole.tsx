// RF-05 — Guard de ruta por rol
// Uso: <RequireRole allow={['tecnico','jefe']}>…</RequireRole>

import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator />
      </View>
    );
  }

  const rol = profile?.rol ?? null;
  const roleOk = hasAnyRole(rol, allow);
  const permOk = !permissions || permissions.every((p) => can(rol, p));

  if (!roleOk || !permOk) {
    return (
      (fallback as React.ReactElement) ?? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>Acceso denegado</Text>
          <Text style={{ marginTop: 8, textAlign: 'center', opacity: 0.7 }}>
            Tu rol ({rol ?? 'sin sesión'}) no tiene permiso para esta sección.
          </Text>
        </View>
      )
    );
  }

  return <>{children}</>;
}
