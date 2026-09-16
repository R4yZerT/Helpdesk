// RF-05 — Guard por permiso (web). Paridad con mobile RequirePermission.
// Verifica can() derivado de profiles.rol. Fail-closed con mensaje auditable.
import { Text, View } from 'react-native';
import type { Permission } from '@helpdesk/shared';
import { useAuth } from '../context/AuthContext';

export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { can, profile, loading } = useAuth();
  if (loading) return <View style={{ padding: 24 }}><Text>Cargando…</Text></View>;
  if (!profile) return null;
  if (!can(permission)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontWeight: '700' }}>Acceso denegado</Text>
        <Text style={{ opacity: 0.6, marginTop: 8, textAlign: 'center' }}>
          Tu rol {profile.rol} no tiene {permission}. Contacta al administrador.
        </Text>
      </View>
    );
  }
  return <>{children}</>;
}
