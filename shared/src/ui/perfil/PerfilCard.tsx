// RF-27 — Mi Perfil Sleek v2 minimalista (foto+tel editables, resto lectura gris #F6F8FB)
// Reusable презентаción usada por web y mobile (mismo contenido, layout diferente)
import * as React from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme.js';

export type PerfilProps = {
  nombre: string;
  email: string | null;
  cedula: string | null;
  rol: string;
  mesaNombre: string | null;
  telefono: string | null;
  avatarUrl: string | null;
  onTelefonoSave: (tel: string | null) => Promise<void>;
  onAvatarPick: () => void;
  variant?: 'mobile' | 'web';
};

export function PerfilCard({ nombre, email, cedula, rol, mesaNombre, telefono, avatarUrl, onTelefonoSave, onAvatarPick, variant='mobile' }: PerfilProps) {
  const [tel, setTel] = React.useState(telefono ?? '');
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  React.useEffect(()=>{ setTel(telefono ?? ''); }, [telefono]);
  const initials = (nombre||'?').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
  const dirty = (tel.trim() || '') !== (telefono ?? '');
  const telValid = !tel.trim() || /^[0-9 +()\-]{7,20}$/.test(tel.trim());

  const doSave = async () => {
    if (!telValid) { setMsg('Teléfono inválido (7-20 dígitos)'); return; }
    setSaving(true); setMsg(null);
    try { await onTelefonoSave(tel.trim() || null); setMsg('Teléfono guardado ✓'); setTimeout(()=>setMsg(null), 2500); } catch(e:any){ setMsg(e?.message ?? 'Error al guardar'); } finally { setSaving(false); }
  };

  const isWeb = variant==='web';
  return (
    <View style={[s.root, isWeb && s.rootWeb]}>
      {/* Card 1 — Avatar */}
      <View style={s.card}>
        <View style={s.avatarRow}>
          <View style={s.avatarWrap}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} /> : <View style={[s.avatarImg, s.avatarFallback]}><Text style={s.avatarInitials}>{initials}</Text></View>}
          </View>
          <View style={{ flex:1, gap:4 }}>
            <Text style={s.nombre}>{nombre}</Text>
            <Text style={s.rol}>{rol}{mesaNombre ? ` · ${mesaNombre}` : ''}</Text>
          </View>
        </View>
        <Pressable onPress={onAvatarPick} style={s.btnGhost}><Text style={s.btnGhostText}>Cambiar foto</Text></Pressable>
        <Text style={s.hint}>JPG/PNG/WebP máx 5 MB. La foto es lo único editable junto al teléfono.</Text>
      </View>

      {/* Card 2 — Teléfono editable */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Teléfono</Text>
        <Text style={s.cardSub}>Solo este campo es editable. Se guarda en tu perfil.</Text>
        <View style={[s.inputWrap, !telValid && s.inputErr]}>
          <TextInput value={tel} onChangeText={setTel} placeholder="Ej: 300 123 4567" keyboardType="phone-pad" style={s.input} placeholderTextColor={theme.colors.mutedSoft} />
        </View>
        {!telValid ? <Text style={s.err}>Formato: 7-20 caracteres, solo dígitos, espacios, + ( ) -</Text> : null}
        {msg ? <Text style={[s.msg, msg.includes('✓') && { color: theme.colors.success }]}>{msg}</Text> : null}
        <Pressable onPress={doSave} disabled={!dirty || saving || !telValid} style={[s.btnPrimary, (!dirty || saving || !telValid) && { opacity:0.45 }]}><Text style={s.btnPrimaryText}>{saving ? 'Guardando…' : 'Guardar teléfono'}</Text></Pressable>
      </View>

      {/* Card 3 — Datos solo lectura (gris #F6F8FB) */}
      <View style={[s.card, s.cardMuted]}>
        <Text style={s.cardTitle}>Datos de cuenta</Text>
        <Text style={s.cardSub}>Solo lectura. Contacta al administrador para cambios.</Text>
        <View style={s.readGrid}>
          <ReadRow label="Nombre completo" value={nombre} />
          <ReadRow label="Correo" value={email ?? '—'} />
          <ReadRow label="Cédula" value={cedula ?? '—'} />
          <ReadRow label="Rol" value={rol} />
          <ReadRow label="Dependencia" value={mesaNombre ?? '—'} />
        </View>
      </View>
    </View>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.readRow}>
      <Text style={s.readLabel}>{label}</Text>
      <Text style={s.readValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16, padding: 16 },
  rootWeb: { maxWidth: 680, alignSelf: 'center', width: '100%' as any },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, padding: 20, gap: 10, ...theme.shadow.soft as any },
  cardMuted: { backgroundColor: '#F6F8FB' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  cardSub: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', borderWidth: 2, borderColor: theme.colors.border },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 22, fontWeight: '800', color: theme.colors.primaryDark },
  nombre: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  rol: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  hint: { fontSize: 11, color: theme.colors.mutedSoft },
  inputWrap: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12, height: 44, justifyContent: 'center' },
  inputErr: { borderColor: theme.colors.danger },
  input: { fontSize: 14, color: theme.colors.text, flex: 1 },
  err: { fontSize: 11, color: theme.colors.danger },
  msg: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  btnPrimary: { backgroundColor: theme.colors.primary, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  btnGhost: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF', height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { color: theme.colors.textSoft, fontWeight: '700', fontSize: 13 },
  readGrid: { gap: 10, marginTop: 4 },
  readRow: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  readLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: '#64748B' },
  readValue: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
});
