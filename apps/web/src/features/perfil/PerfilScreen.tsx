// RF-27 Mi Perfil — web (desktop max-w 680px centrado, mismo 3 cards que móvil)
import * as React from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PerfilCard } from '@helpdesk/shared';
import { theme, updateProfile, uploadAvatar, explainUserError, FeedbackModal } from '@helpdesk/shared';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export function PerfilScreen() {
  const { profile, refreshProfile } = useAuth();
  const [mesaNombre, setMesaNombre] = React.useState<string | null>(null);
  const [pendingFile, setPendingFile] = React.useState<{ file: File; sizeMb: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ visible: boolean; variant: 'success' | 'error' | 'info'; title: string; message?: string } | null>(null);

  React.useEffect(() => {
    if (!profile?.mesa_id) { setMesaNombre(null); return; }
    (supabase.from('mesas').select('nombre').eq('id', profile.mesa_id).maybeSingle() as any).then(({ data }: any) => {
      if (data?.nombre) setMesaNombre(data.nombre);
    });
  }, [profile?.mesa_id]);

  if (!profile) return <View style={s.loading}><ActivityIndicator color={theme.colors.primary} /><Text style={{ color: theme.colors.muted, marginTop: 8 }}>Cargando perfil…</Text></View>;

  const onSave = async (patch: { nombre: string; email: string; telefono: string | null }) => {
    await updateProfile(supabase as any, profile.id, { full_name: patch.nombre, email: patch.email, telefono: patch.telefono });
    await refreshProfile();
  };
  // Paso 1: elige archivo, valida y pide confirmación
  const onAvatarPick = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp,image/gif';
      input.onchange = async () => {
        const file = input.files?.[0]; if (!file) return;
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        if (file.size > 5 * 1024 * 1024) {
          setFeedback({ visible: true, variant: 'error', title: 'Archivo muy grande', message: `La foto pesa ${sizeMb} MB y el máximo es 5 MB (motivo: tamaño excedido). Elige una imagen más liviana.` });
          return;
        }
        setPendingFile({ file, sizeMb });
      };
      input.click();
    }
  };
  // Paso 2: se ejecuta solo al confirmar en el modal
  const doAvatarUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      await uploadAvatar(supabase as any, profile.id, pendingFile.file, pendingFile.file.name);
      await refreshProfile();
      setPendingFile(null);
      setFeedback({ visible: true, variant: 'success', title: 'Foto actualizada', message: 'Tu foto de perfil se cambió correctamente.' });
    } catch (e: any) {
      setFeedback({ visible: true, variant: 'error', title: 'Error al subir foto', message: explainUserError(e) });
    } finally { setUploading(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ paddingVertical: 24 }}>
      <View style={s.header}><Text style={s.title}>Mi perfil</Text></View>
      <PerfilCard nombre={profile.full_name ?? profile.email ?? '—'} email={profile.email} cedula={profile.cedula} rol={profile.rol} mesaNombre={mesaNombre} telefono={profile.telefono} avatarUrl={profile.avatar_url} onSave={onSave} onAvatarPick={onAvatarPick} variant="web" />
      <FeedbackModal visible={!!pendingFile} variant="confirm" title="Confirmar foto de perfil" message={pendingFile ? `¿Usar "${pendingFile.file.name}" (${pendingFile.sizeMb} MB) como tu foto?` : undefined} confirmText="Subir foto" cancelText="Cancelar" loading={uploading} onConfirm={doAvatarUpload} onClose={() => setPendingFile(null)} onCancel={() => setPendingFile(null)} />
      {feedback ? <FeedbackModal visible={feedback.visible} variant={feedback.variant as never} title={feedback.title} message={feedback.message} onClose={() => setFeedback(null)} onConfirm={() => setFeedback(null)} /> : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  header: { maxWidth: 680, alignSelf: 'center', width: '100%' as any, paddingHorizontal: 16, marginBottom: 4, gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  sub: { fontSize: 12, color: theme.colors.muted },
});
