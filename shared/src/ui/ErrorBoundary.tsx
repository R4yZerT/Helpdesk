// H6 — ErrorBoundary compartido web/mobile: evita que un fallo en
// una pantalla crashee toda la app. Usar por navigator.
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme.js';
import { Card } from './components.js';

type Props = {
  children: React.ReactNode;
  titulo?: string;
  /** Reportero externo (Sentry). Opcional para no acoplar shared. */
  onError?: (error: Error, info: string) => void;
};

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
    try {
      this.props.onError?.(error, info.componentStack ?? '');
    } catch {
      // El reportero nunca debe romper el fallback
    }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={s.wrap}>
          <Card style={s.card}>
            <Text style={s.title}>{this.props.titulo ?? 'Algo salió mal'}</Text>
            <Text style={s.sub}>Esta sección no pudo cargarse. El resto de la app sigue disponible.</Text>
            <Pressable
              onPress={() => this.setState({ error: null })}
              style={s.btn}
              accessibilityRole="button"
              accessibilityLabel="Reintentar"
            >
              <Text style={s.btnText}>Reintentar</Text>
            </Pressable>
          </Card>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg },
  card: { gap: 8, padding: 20, maxWidth: 420, width: '100%' },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  sub: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  btn: { marginTop: 6, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 11, borderRadius: theme.radius.full, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
