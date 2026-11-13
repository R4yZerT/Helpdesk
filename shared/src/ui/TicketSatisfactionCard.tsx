import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { submitTicketSatisfaccion } from '../tickets.js';
import { FilterDropdown } from './FilterDropdown.js';
import { theme } from './theme.js';

const QUESTIONS = [
  ['calidadServicio', '¿Cómo fue la atención del técnico?'],
  ['tiempoRespuesta', '¿Cómo califica el tiempo de respuesta?'],
  ['comunicacion', '¿Cómo fue la comunicación durante la atención?'],
  ['solucionResolvio', '¿La solución resolvió su problema?'],
] as const;

type Scores = { calidadServicio: number; tiempoRespuesta: number; comunicacion: number; solucionResolvio: number };

export function TicketSatisfactionCard({ client, ticketId }: { client: SupabaseClient; ticketId: string }) {
  const [scores, setScores] = useState<Scores>({ calidadServicio: 0, tiempoRespuesta: 0, comunicacion: 0, solucionResolvio: 0 });
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void client.from('ticket_satisfaccion').select('id').eq('ticket_id', ticketId).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        else setSubmitted(!!data);
      });
    return () => { active = false; };
  }, [client, ticketId]);

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      await submitTicketSatisfaccion(client, ticketId, { ...scores, comentario: comment });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Encuesta de satisfacción</Text>
      {submitted ? <Text style={styles.done}>Gracias por compartir su experiencia.</Text> : (
        <>
          {QUESTIONS.map(([key, label]) => (
            <FilterDropdown<number>
              key={key}
              label={label}
              value={scores[key] || ''}
              options={[1, 2, 3, 4, 5].map((score) => ({ value: score, label: `${score} · ${score === 1 ? 'Muy malo' : score === 5 ? 'Excelente' : 'Regular'}` }))}
              placeholder="Selecciona una calificación"
              onSelect={(value) => setScores((current) => ({ ...current, [key]: Number(value) }))}
            />
          ))}
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Comentario opcional"
            maxLength={1000}
            multiline
            style={styles.input}
          />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable onPress={send} disabled={busy || Object.values(scores).some((score) => score === 0)} style={[styles.button, (busy || Object.values(scores).some((score) => score === 0)) && styles.disabled]}>
            <Text style={styles.buttonText}>{busy ? 'Enviando…' : 'Enviar encuesta'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: theme.colors.surface },
  title: { color: theme.colors.text, fontWeight: '800', fontSize: 16 },
  done: { color: theme.colors.success, fontWeight: '700' },
  input: { minHeight: 76, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 10, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, textAlignVertical: 'top' },
  error: { color: theme.colors.danger, fontSize: 12 },
  button: { minHeight: 42, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  buttonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
