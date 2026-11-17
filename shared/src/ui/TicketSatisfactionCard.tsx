import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTicketSatisfaccion, submitTicketSatisfaccion, validateTicketSatisfaccion } from '../tickets.js';
import { theme } from './theme.js';

export function TicketSatisfactionCard({ client, ticketId }: { client: SupabaseClient; ticketId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchTicketSatisfaccion(client, ticketId)
      .then((satisfaction) => {
        if (!active) return;
        setSubmitted(!!satisfaction);
        if (satisfaction) {
          setRating(satisfaction.calificacion);
          setComment(satisfaction.comentario ?? '');
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [client, ticketId]);

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      const validationError = validateTicketSatisfaccion({ calificacion: rating, comentario: comment });
      if (validationError) {
        setError(validationError);
        return;
      }
      await submitTicketSatisfaccion(client, ticketId, { calificacion: rating, comentario: comment });
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
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : submitted ? <Text style={styles.done}>Gracias por compartir su experiencia. Calificación: {rating} de 5.</Text> : (
        <>
          <Text style={styles.prompt}>¿Qué tan satisfecho estás con la atención recibida?</Text>
          <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Calificación de satisfacción">
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => { setRating(value); setError(null); }}
                style={[styles.star, value <= rating && styles.starSelected]}
                accessibilityRole="radio"
                accessibilityLabel={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
                accessibilityState={{ selected: rating === value }}
              >
                <Text style={[styles.starText, value <= rating && styles.starTextSelected]}>{value <= rating ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Comentario opcional"
            maxLength={1000}
            multiline
            style={styles.input}
          />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable onPress={send} disabled={busy || rating === 0} style={[styles.button, (busy || rating === 0) && styles.disabled]}>
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
  prompt: { color: theme.colors.textSoft, fontSize: 14 },
  stars: { flexDirection: 'row', gap: 8 },
  star: { minWidth: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: theme.colors.surfaceAlt },
  starSelected: { borderColor: theme.colors.accent, backgroundColor: theme.colors.orange50 },
  starText: { color: theme.colors.mutedSoft, fontSize: 24, lineHeight: 28 },
  starTextSelected: { color: theme.colors.accentStrong },
  input: { minHeight: 76, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 10, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, textAlignVertical: 'top' },
  error: { color: theme.colors.danger, fontSize: 12 },
  button: { minHeight: 42, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  buttonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
