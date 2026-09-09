// RF-27 Mi Perfil — web (desktop max-w 680px centrado, mismo 3 cards que móvil)
import * as React from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PerfilCard } from '@helpdesk/shared';
import { theme, updateProfile, uploadAvatar } from '@helpdesk/shared';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export function PerfilScreen() {
  const { profile, refreshProfile } = useAuth();
  const [mesaNombre, setMesaNombre] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profile?.mesa_id) { setMesaNombre(null); return; }
    (supabase.from('mesas').select('nombre').eq('id', profile.mesa_id).maybeSingle() as any).then(({ data }: any) => {
      if (data?.nombre) setMesaNombre(data.nombre);
    });
  }, [profile?.mesa_id]);

  if (!profile) return <View style={s.loading}><ActivityIndicator color={theme.colors.primary} /><Text style={{ color: theme.colors.muted, marginTop: 8 }}>Cargando perfil…</Text></View>;

  const onTelefonoSave = async (tel: string | null) => {
    await updateProfile(supabase as any, profile.id, { telefono: tel });
    await refreshProfile();
  };
  const onAvatarPick = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp,image/gif';
      input.onchange = async () => {
        const file = input.files?.[0]; if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Archivo muy grande (máx 5 MB)'); return; }
        try { await uploadAvatar(supabase as any, profile.id, file, file.name); await refreshProfile(); } catch (e: any) { alert(e?.message ?? 'Error al subir avatar'); }
      };
      input.click();
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ paddingVertical: 24 }}>
      <View style={s.header}><Text style={s.title}>Mi perfil</Text><Text style={s.sub}>Foto y teléfono editables · resto solo lectura</Text></View>
      <PerfilCard nombre={profile.full_name ?? profile.email ?? '—'} email={profile.email} cedula={profile.cedula} rol={profile.rol} mesaNombre={mesaNombre} telefono={profile.telefono} avatarUrl={profile.avatar_url} onTelefonoSave={onTelefonoSave} onAvatarPick={onAvatarPick} variant="web" />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  header: { maxWidth: 680, alignSelf: 'center', width: '100%' as any, paddingHorizontal: 16, marginBottom: 4, gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  sub: { fontSize: 12, color: theme.colors.muted },
});
