// RF-05 — Guard híbrido (Atributos: Seguridad fail-closed + Mantenibilidad)
// No confía solo en navegación: verifica can() derivado de profiles.rol (fuente RLS).
// Si no tiene permiso, muestra bloqueado (no redirige silencioso para auditabilidad).
import { Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { Permission } from '@helpdesk/shared';

export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { can, profile } = useAuth();
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
