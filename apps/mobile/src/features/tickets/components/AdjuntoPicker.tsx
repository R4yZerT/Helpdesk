// RF-07 — Selector de adjuntos (web: input file, nativo: DocumentPicker) — sub-componente de CreateTicketScreen
import { Platform, Pressable, Text, View } from 'react-native';

type Props = {
  adjuntos: { name: string; size: number; type: string; file: Blob }[];
  adjuntoError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFiles: (files: FileList | null) => void;
  onPickNative: () => Promise<void>;
  onRemove: (index: number) => void;
  onAdjuntoError: (msg: string | null) => void;
};

export function AdjuntoPicker({ adjuntos, adjuntoError, fileInputRef, onPickFiles, onPickNative, onRemove, onAdjuntoError }: Props) {
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => { if (Platform.OS === 'web') { fileInputRef.current?.click?.(); } else { void onPickNative(); } }}
        style={{ borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', borderRadius: 12, backgroundColor: '#F8FAFC', padding: 18, alignItems: 'center', gap: 4 }}
        accessibilityRole="button" accessibilityLabel="Seleccionar adjuntos"
      >
        <Text style={{ fontSize: 18, color: '#94A3B8' }}>⤒</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>Adjuntos (opcional) — tocar para cargar</Text>
        <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>Imágenes, PDF o Word (DOC/DOCX) · 10 MB máx · 5 máx {adjuntos.length ? `· ${adjuntos.length} seleccionado(s)` : ''}</Text>
      </Pressable>
      {Platform.OS === 'web' ? (
        <View style={{ display: 'none' } as unknown as object}>
          <input
            ref={fileInputRef as unknown as never}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.doc,.docx"
            multiple
            onChange={(e: { target: { files: FileList | null; value: string } }) => { onPickFiles(e.target.files); (e.target as HTMLInputElement).value = ''; }}
          />
        </View>
      ) : null}
      {adjuntoError ? <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '600' }}>{adjuntoError}</Text> : null}
      {adjuntos.length ? (
        <View style={{ gap: 6 }}>
          {adjuntos.map((a, i) => (
            <View key={`${a.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ fontSize: 11, color: '#334155', flex: 1, fontWeight: '600' }} numberOfLines={1}>{a.name} · {(a.size / 1024).toFixed(0)} KB</Text>
              <Pressable onPress={() => onRemove(i)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }}>
                <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '700' }}>Quitar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}