// RF-27 Mi Perfil — mobile (mismo 3 cards que web)
import * as React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PerfilCard } from '@helpdesk/shared';
import { theme, updateProfile, uploadAvatar, explainUserError, FeedbackModal } from '@helpdesk/shared';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export function PerfilScreen() {
  const { profile, refreshProfile } = useAuth();
  const [mesaNombre, setMesaNombre] = React.useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = React.useState<{ uri: string; name: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ visible: boolean; variant: 'success' | 'error' | 'info'; title: string; message?: string } | null>(null);
  React.useEffect(() => {
    if (!profile?.mesa_id) { setMesaNombre(null); return; }
    (supabase.from('mesas').select('nombre').eq('id', profile.mesa_id).maybeSingle() as any).then(({ data }: any) => { if (data?.nombre) setMesaNombre(data.nombre); });
  }, [profile?.mesa_id]);

  if (!profile) return <View style={s.loading}><ActivityIndicator color={theme.colors.primary} /><Text style={{ color: theme.colors.muted, marginTop: 8 }}>Cargando perfil…</Text></View>;

  const onSave = async (patch: { nombre: string; email: string; telefono: string | null }) => {
    await updateProfile(supabase as any, profile.id, { full_name: patch.nombre, email: patch.email, telefono: patch.telefono });
    await refreshProfile();
  };
  // Paso 1: pide permiso, elige foto y pide confirmación
  const onAvatarPick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setFeedback({ visible: true, variant: 'error', title: 'Permiso requerido', message: 'No diste acceso a tus fotos (motivo: permiso denegado). Permite el acceso en ajustes para cambiar tu avatar.' }); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setPendingAvatar({ uri: asset.uri, name: asset.fileName ?? 'avatar.jpg' });
  };
  // Paso 2: se ejecuta solo al confirmar en el modal
  const doAvatarUpload = async () => {
    if (!pendingAvatar) return;
    setUploading(true);
    try {
      const resp = await fetch(pendingAvatar.uri);
      const blob = await resp.blob();
      await uploadAvatar(supabase as any, profile.id, blob, pendingAvatar.name);
      await refreshProfile();
      setPendingAvatar(null);
      setFeedback({ visible: true, variant: 'success', title: 'Foto actualizada', message: 'Tu foto de perfil se cambió correctamente.' });
    } catch (e: any) { setFeedback({ visible: true, variant: 'error', title: 'Error al subir foto', message: explainUserError(e) }); }
    finally { setUploading(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={s.header}><Text style={s.title}>Mi perfil</Text></View>
      <PerfilCard nombre={profile.full_name ?? profile.email ?? '—'} email={profile.email} cedula={profile.cedula} rol={profile.rol} mesaNombre={mesaNombre} telefono={profile.telefono} avatarUrl={profile.avatar_url} onSave={onSave} onAvatarPick={onAvatarPick} variant="mobile" />
      <FeedbackModal visible={!!pendingAvatar} variant="confirm" title="Confirmar foto de perfil" message={pendingAvatar ? `¿Usar "${pendingAvatar.name}" como tu foto?` : undefined} confirmText="Subir foto" cancelText="Cancelar" loading={uploading} onConfirm={doAvatarUpload} onClose={() => setPendingAvatar(null)} onCancel={() => setPendingAvatar(null)} />
      {feedback ? <FeedbackModal visible={feedback.visible} variant={feedback.variant as never} title={feedback.title} message={feedback.message} onClose={() => setFeedback(null)} onConfirm={() => setFeedback(null)} /> : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  sub: { fontSize: 12, color: theme.colors.muted },
});
