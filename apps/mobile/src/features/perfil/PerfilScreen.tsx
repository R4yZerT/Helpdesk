// RF-27 Mi Perfil — mobile (mismo 3 cards que web)
import * as React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PerfilCard } from '@helpdesk/shared';
import { theme, updateProfile, uploadAvatar } from '@helpdesk/shared';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export function PerfilScreen() {
  const { profile, refreshProfile } = useAuth();
  const [mesaNombre, setMesaNombre] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!profile?.mesa_id) { setMesaNombre(null); return; }
    (supabase.from('mesas').select('nombre').eq('id', profile.mesa_id).maybeSingle() as any).then(({ data }: any) => { if (data?.nombre) setMesaNombre(data.nombre); });
  }, [profile?.mesa_id]);

  if (!profile) return <View style={s.loading}><ActivityIndicator color={theme.colors.primary} /><Text style={{ color: theme.colors.muted, marginTop: 8 }}>Cargando perfil…</Text></View>;

  const onTelefonoSave = async (tel: string | null) => {
    await updateProfile(supabase as any, profile.id, { telefono: tel });
    await refreshProfile();
  };
  const onAvatarPick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso requerido', 'Permite acceso a fotos para cambiar tu avatar.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const uri = asset.uri;
    try {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      await uploadAvatar(supabase as any, profile.id, blob, asset.fileName ?? 'avatar.jpg');
      await refreshProfile();
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'No se pudo subir la foto'); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={s.header}><Text style={s.title}>Mi perfil</Text><Text style={s.sub}>Foto y teléfono editables · resto solo lectura</Text></View>
      <PerfilCard nombre={profile.full_name ?? profile.email ?? '—'} email={profile.email} cedula={profile.cedula} rol={profile.rol} mesaNombre={mesaNombre} telefono={profile.telefono} avatarUrl={profile.avatar_url} onTelefonoSave={onTelefonoSave} onAvatarPick={onAvatarPick} variant="mobile" />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  sub: { fontSize: 12, color: theme.colors.muted },
});
