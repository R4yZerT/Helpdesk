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
  onSave: (patch: { nombre: string; email: string; telefono: string | null }) => Promise<void>;
  onAvatarPick: () => void;
  variant?: 'mobile' | 'web';
  // compat: alias antiguo todavía aceptado pero ignorado si onSave existe
  onTelefonoSave?: (tel: string | null) => Promise<void>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PerfilCard({ nombre, email, cedula, rol, mesaNombre, telefono, avatarUrl, onSave, onAvatarPick, variant='mobile' }: PerfilProps) {
  const [nom, setNom] = React.useState(nombre ?? '');
  const [mail, setMail] = React.useState(email ?? '');
  const [tel, setTel] = React.useState(telefono ?? '');
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ text: string; ok?: boolean } | null>(null);
  const [touched, setTouched] = React.useState<{ nom?: boolean; mail?: boolean; tel?: boolean }>({});
  React.useEffect(()=>{ setNom(nombre ?? ''); }, [nombre]);
  React.useEffect(()=>{ setMail(email ?? ''); }, [email]);
  React.useEffect(()=>{ setTel(telefono ?? ''); }, [telefono]);
  const initials = (nombre||'?').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
  const nomTrim = nom.trim();
  const mailTrim = mail.trim();
  const telTrim = tel.trim();
  const nomErr = !nomTrim ? 'Nombre requerido (no puede ser vacío ni solo espacios)' : nomTrim.length < 2 ? 'Mínimo 2 caracteres' : null;
  const mailErr = !mailTrim ? 'Correo requerido' : !EMAIL_RE.test(mailTrim) ? 'Formato de correo inválido (ej: nombre@dominio.com)' : null;
  const telErr = !telTrim ? null : !/^[0-9 +()\-]{7,20}$/.test(telTrim) ? 'Formato: 7-20, solo dígitos, espacios, + ( ) -' : null;
  const dirty = nomTrim !== (nombre ?? '').trim() || mailTrim !== (email ?? '').trim() || telTrim !== (telefono ?? '').trim();
  const hasErr = !!(nomErr || mailErr || telErr);

  const doSave = async () => {
    setTouched({ nom: true, mail: true, tel: true });
    if (nomErr || mailErr || telErr) { setMsg({ text: nomErr ?? mailErr ?? telErr ?? 'Corrige los campos marcados' }); return; }
    if (!dirty) return;
    setSaving(true); setMsg(null);
    try { await onSave({ nombre: nomTrim, email: mailTrim, telefono: telTrim || null }); setMsg({ text: 'Cambios guardados ✓', ok: true }); setTimeout(()=>setMsg(null), 2500); } catch(e:any){ setMsg({ text: e?.message ?? 'Error al guardar' }); } finally { setSaving(false); }
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
        <Text style={s.hint}>JPG/PNG/WebP máx 5 MB.</Text>
      </View>

      {/* Card 2 — Datos editables: Nombre, Correo, Teléfono + Guardar único */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Datos editables</Text>
        <Text style={s.cardSub}>Nombre, correo y teléfono se guardan juntos con el botón Guardar cambios.</Text>
        <View style={s.fieldGap}>
          <Text style={s.fieldLabel}>Nombre completo *</Text>
          <View style={[s.inputWrap, touched.nom && nomErr && s.inputErr, touched.nom && nomErr && s.inputErrBg]}>
            <TextInput value={nom} onChangeText={(v)=>{ setNom(v); if(!touched.nom) setTouched(t=>({...t, nom:true})); }} onBlur={()=> setTouched(t=>({...t, nom:true}))} placeholder="Nombre completo" style={s.input} placeholderTextColor={theme.colors.mutedSoft} />
          </View>
          {touched.nom && nomErr ? <Text style={s.err}>{nomErr}</Text> : null}
        </View>
        <View style={s.fieldGap}>
          <Text style={s.fieldLabel}>Correo *</Text>
          <View style={[s.inputWrap, touched.mail && mailErr && s.inputErr, touched.mail && mailErr && s.inputErrBg]}>
            <TextInput value={mail} onChangeText={(v)=>{ setMail(v); if(!touched.mail) setTouched(t=>({...t, mail:true})); }} onBlur={()=> setTouched(t=>({...t, mail:true}))} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" style={s.input} placeholderTextColor={theme.colors.mutedSoft} />
          </View>
          {touched.mail && mailErr ? <Text style={s.err}>{mailErr}</Text> : null}
        </View>
        <View style={s.fieldGap}>
          <Text style={s.fieldLabel}>Teléfono</Text>
          <View style={[s.inputWrap, touched.tel && telErr && s.inputErr, touched.tel && telErr && s.inputErrBg]}>
            <TextInput value={tel} onChangeText={(v)=>{ setTel(v); if(!touched.tel) setTouched(t=>({...t, tel:true})); }} onBlur={()=> setTouched(t=>({...t, tel:true}))} placeholder="Ej: 300 123 4567" keyboardType="phone-pad" style={s.input} placeholderTextColor={theme.colors.mutedSoft} />
          </View>
          {touched.tel && telErr ? <Text style={s.err}>{telErr}</Text> : null}
        </View>
        {msg ? <Text style={[s.msg, msg.ok && { color: theme.colors.success }]}>{msg.text}</Text> : null}
        <Pressable onPress={doSave} disabled={!dirty || saving} style={[s.btnPrimary, (!dirty || saving) && { opacity:0.45 }]}><Text style={s.btnPrimaryText}>{saving ? 'Guardando…' : 'Guardar cambios'}</Text></Pressable>
      </View>

      {/* Card 3 — Datos solo lectura (gris #F6F8FB) */}
      <View style={[s.card, s.cardMuted]}>
        <Text style={s.cardTitle}>Datos de cuenta (solo lectura)</Text>
        <Text style={s.cardSub}>Cédula, rol y dependencia no son editables.</Text>
        <View style={s.readGrid}>
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
  fieldGap: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textSoft, letterSpacing: 0.3 },
  inputWrap: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12, height: 44, justifyContent: 'center' },
  inputErr: { borderColor: theme.colors.danger, borderWidth: 1.5 },
  inputErrBg: { backgroundColor: '#FEF2F2' },
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
