// RF-27 — Mi Perfil Sleek v2 (contenedor único: avatar + datos; badge ✎ Editable / 🔒 Lectura distingue)
// Reusable presentación usada por web y mobile (mismo contenido, layout diferente)
import * as React from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme.js';
import { FeedbackModal } from '../FeedbackModal.js';
import { explainUserError } from '../../admin.js';
import { formatRol } from '../../filters.js';

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
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ visible: boolean; variant: 'success' | 'error'; title: string; message?: string } | null>(null);
  const [touched, setTouched] = React.useState<{ nom?: boolean; mail?: boolean; tel?: boolean }>({});
  React.useEffect(()=>{ setNom(nombre ?? ''); }, [nombre]);
  React.useEffect(()=>{ setMail(email ?? ''); }, [email]);
  React.useEffect(()=>{ setTel(telefono ?? ''); }, [telefono]);
  const nomTrim = nom.trim();
  const mailTrim = mail.trim();
  const telTrim = tel.trim();
  const nomErr = !nomTrim ? 'Nombre requerido (vacío o solo espacios)' : nomTrim.length < 2 ? `Nombre muy corto: mínimo 2 caracteres (recibido: ${nomTrim.length})` : null;
  const mailErr = !mailTrim ? 'Correo requerido' : !EMAIL_RE.test(mailTrim) ? 'Formato de correo inválido (ej: nombre@dominio.com)' : null;
  const telErr = !telTrim ? null : !/^[0-9 +()\-]{7,20}$/.test(telTrim) ? 'Formato: 7-20, solo dígitos, espacios, + ( ) -' : null;
  const dirty = nomTrim !== (nombre ?? '').trim() || mailTrim !== (email ?? '').trim() || telTrim !== (telefono ?? '').trim();
  const hasErr = !!(nomErr || mailErr || telErr);

  // Resumen antes → después para el modal de confirmación
  const changeSummary = [
    nomTrim !== (nombre ?? '').trim() ? `• Nombre: ${nombre?.trim() || '—'} → ${nomTrim}` : null,
    mailTrim !== (email ?? '').trim() ? `• Correo: ${email?.trim() || '—'} → ${mailTrim}` : null,
    telTrim !== (telefono ?? '').trim() ? `• Teléfono: ${telefono?.trim() || '—'} → ${telTrim || '—'}` : null,
  ].filter(Boolean).join('\n');

  // Paso 1: valida y pide confirmación con resumen
  const requestSave = () => {
    setTouched({ nom: true, mail: true, tel: true });
    if (nomErr || mailErr || telErr) {
      const msg = nomErr ?? mailErr ?? telErr ?? 'Corrige los campos marcados';
      setMsg({ text: msg });
      setFeedback({ visible: true, variant: 'error', title: 'Datos inválidos', message: msg });
      return;
    }
    if (!dirty) return;
    setConfirmOpen(true);
  };

  // Paso 2: se ejecuta solo al confirmar en el modal
  const doSave = async () => {
    setSaving(true); setMsg(null);
    try {
      await onSave({ nombre: nomTrim, email: mailTrim, telefono: telTrim || null });
      setConfirmOpen(false);
      setMsg({ text: 'Cambios guardados ✓', ok: true }); setTimeout(()=>setMsg(null), 2500);
    } catch(e:any){
      const msg = explainUserError(e);
      setMsg({ text: msg });
      setFeedback({ visible: true, variant: 'error', title: 'Error al guardar perfil', message: msg });
    } finally { setSaving(false); }
  };

  const isWeb = variant==='web';
  return (
    <View style={[s.root, isWeb && s.rootWeb]}>
      {/* Contenedor único — avatar + todos los datos (editables y lectura) */}
      <View style={s.card}>
        {/* Encabezado avatar */}
        <View style={s.avatarRow}>
          {avatarUrl ? (
          <View style={s.avatarWrap}>
            <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
          </View>
          ) : null}
          <View style={{ flex:1, gap:4 }}>
            <Text style={s.nombre}>{nombre}</Text>
            <Text style={s.rol}>{formatRol(rol as never)}{mesaNombre ? ` · ${mesaNombre}` : ''}</Text>
          </View>
        </View>
        <Pressable onPress={onAvatarPick} style={s.btnGhost} accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil"><Text style={s.btnGhostText}>Cambiar foto</Text></Pressable>
        <Text style={s.hint}>JPG/PNG/WebP máx 5 MB.</Text>

        <View style={s.divider} />

        <Text style={s.cardTitle}>Datos de la cuenta</Text>
        <Text style={s.cardSub}>Los campos con ✎ Editable se pueden modificar y se guardan juntos. Los marcados 🔒 Lectura los gestiona tu organización.</Text>

        {/* ——— Editables ——— */}
        <View style={s.fieldGap}>
          <FieldLabel label="Nombre completo *" editable />
          <View style={[s.inputWrap, touched.nom && nomErr && s.inputErr, touched.nom && nomErr && s.inputErrBg]}>
            <TextInput value={nom} onChangeText={(v)=>{ setNom(v); if(!touched.nom) setTouched(t=>({...t, nom:true})); }} onBlur={()=> setTouched(t=>({...t, nom:true}))} placeholder="Nombre completo" style={s.input} placeholderTextColor={theme.colors.mutedSoft} accessibilityLabel="Nombre completo, campo editable" />
          </View>
          {touched.nom && nomErr ? <Text style={s.err}>{nomErr}</Text> : null}
        </View>
        <View style={s.fieldGap}>
          <FieldLabel label="Correo *" editable />
          <View style={[s.inputWrap, touched.mail && mailErr && s.inputErr, touched.mail && mailErr && s.inputErrBg]}>
            <TextInput value={mail} onChangeText={(v)=>{ setMail(v); if(!touched.mail) setTouched(t=>({...t, mail:true})); }} onBlur={()=> setTouched(t=>({...t, mail:true}))} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" style={s.input} placeholderTextColor={theme.colors.mutedSoft} accessibilityLabel="Correo, campo editable" />
          </View>
          {touched.mail && mailErr ? <Text style={s.err}>{mailErr}</Text> : null}
        </View>
        <View style={s.fieldGap}>
          <FieldLabel label="Teléfono" editable />
          <View style={[s.inputWrap, touched.tel && telErr && s.inputErr, touched.tel && telErr && s.inputErrBg]}>
            <TextInput value={tel} onChangeText={(v)=>{ setTel(v); if(!touched.tel) setTouched(t=>({...t, tel:true})); }} onBlur={()=> setTouched(t=>({...t, tel:true}))} placeholder="Ej: 300 123 4567" keyboardType="phone-pad" style={s.input} placeholderTextColor={theme.colors.mutedSoft} accessibilityLabel="Teléfono, campo editable" />
          </View>
          {touched.tel && telErr ? <Text style={s.err}>{telErr}</Text> : null}
        </View>

        {/* ——— Solo lectura (mismo contenedor, factor UI: fondo gris + badge 🔒) ——— */}
        <View style={s.fieldGap}>
          <FieldLabel label="Cédula" editable={false} />
          <View style={s.readBox} accessible accessibilityLabel="Cédula, solo lectura" accessibilityState={{ disabled: true }}>
            <Text style={s.readValue} numberOfLines={2}>{cedula ?? '—'}</Text>
          </View>
        </View>
        <View style={s.fieldGap}>
          <FieldLabel label="Rol" editable={false} />
          <View style={s.readBox} accessible accessibilityLabel="Rol, solo lectura" accessibilityState={{ disabled: true }}>
            <Text style={s.readValue} numberOfLines={2}>{formatRol(rol as never)}</Text>
          </View>
        </View>
        <View style={s.fieldGap}>
          <FieldLabel label="Dependencia" editable={false} />
          <View style={s.readBox} accessible accessibilityLabel="Dependencia, solo lectura" accessibilityState={{ disabled: true }}>
            <Text style={s.readValue} numberOfLines={2}>{mesaNombre ?? '—'}</Text>
          </View>
        </View>

        {msg ? <Text style={[s.msg, msg.ok && { color: theme.colors.success }]}>{msg.text}</Text> : null}
        <Pressable onPress={requestSave} disabled={!dirty || saving} style={[s.btnPrimary, (!dirty || saving) && { opacity:0.45 }]} accessibilityRole="button" accessibilityLabel="Guardar cambios del perfil" accessibilityState={{ disabled: !dirty || saving }}><Text style={s.btnPrimaryText}>{saving ? 'Guardando…' : 'Guardar cambios'}</Text></Pressable>
        <FeedbackModal visible={confirmOpen} variant="confirm" title="Confirmar cambios de perfil" message={changeSummary ? `Se aplicarán estos cambios:\n${changeSummary}` : undefined} confirmText="Confirmar cambios" cancelText="Revisar" loading={saving} onConfirm={doSave} onClose={() => setConfirmOpen(false)} onCancel={() => setConfirmOpen(false)} />
        {feedback ? <FeedbackModal visible={feedback.visible} variant={feedback.variant as never} title={feedback.title} message={feedback.message} onClose={() => setFeedback(null)} onConfirm={() => setFeedback(null)} /> : null}
      </View>
    </View>
  );
}

// Etiqueta de campo con indicador UI de editabilidad: badge ✎ Editable (azul) vs 🔒 Lectura (gris)
function FieldLabel({ label, editable }: { label: string; editable: boolean }) {
  return (
    <View style={s.labelRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.badge, editable ? s.badgeEdit : s.badgeRead]} accessible accessibilityLabel={editable ? `${label} editable` : `${label} solo lectura`}>
        <Text style={[s.badgeText, editable ? s.badgeEditText : s.badgeReadText]}>{editable ? '✎ Editable' : '🔒 Lectura'}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16, padding: 16 },
  rootWeb: { maxWidth: 680, alignSelf: 'center', width: '100%' as any },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, padding: 20, gap: 10, ...theme.shadow.soft as any },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  cardSub: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', borderWidth: 2, borderColor: theme.colors.border },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  nombre: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  rol: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  hint: { fontSize: 11, color: theme.colors.mutedSoft },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 6 },
  fieldGap: { gap: 6 },
  // Fila etiqueta + badge indicador
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textSoft, letterSpacing: 0.3 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeEdit: { backgroundColor: theme.colors.primarySoft, borderColor: '#BFDBFE' },
  badgeRead: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  badgeEditText: { color: theme.colors.primaryDark },
  badgeReadText: { color: theme.colors.muted },
  inputWrap: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12, height: 44, justifyContent: 'center' },
  inputErr: { borderColor: theme.colors.danger, borderWidth: 1.5 },
  inputErrBg: { backgroundColor: '#FEF2F2' },
  input: { fontSize: 14, color: theme.colors.text, flex: 1 },
  err: { fontSize: 11, color: theme.colors.danger },
  msg: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  btnPrimary: { backgroundColor: theme.colors.primary, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  btnGhost: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF', height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { color: theme.colors.textSoft, fontWeight: '700', fontSize: 13 },
  // Caja solo lectura: mismo contenedor, factor UI gris + sin interacción
  readBox: { backgroundColor: '#F6F8FB', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  readValue: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
});
