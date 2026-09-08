// Íconos sin dependencias externas — evita react-native-svg en shared (rompía web bundling)
// Usa View/Text puros para no requerir native modules; sin emojis.
import { View, Text, StyleSheet } from 'react-native';

type P = { size?: number; color?: string };

export function IconEye({ size = 18, color = '#64748b' }: P) {
  const r = size * 0.22;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.eyeOuter, { width: size * 0.9, height: size * 0.55, borderColor: color, borderRadius: size }]}>
        <View style={[styles.eyeInner, { width: r * 2, height: r * 2, borderRadius: r, borderColor: color, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function IconEyeOff({ size = 18, color = '#64748b' }: P) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.eyeOuter, { width: size * 0.9, height: size * 0.55, borderColor: color, borderRadius: size }]}>
        <View style={[styles.eyeInner, { width: size * 0.22 * 2, height: size * 0.22 * 2, borderRadius: size * 0.22, borderColor: color, backgroundColor: 'transparent', borderWidth: 1.5 }]} />
      </View>
      <View style={[styles.slash, { backgroundColor: color, width: size * 1.15, transform: [{ rotate: '-35deg' }] }]} />
    </View>
  );
}

export function IconLock({ size = 16, color = '#64748b' }: P) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.lockShackle, { width: size * 0.55, height: size * 0.45, borderColor: color, borderTopLeftRadius: size * 0.3, borderTopRightRadius: size * 0.3 }]} />
      <View style={[styles.lockBody, { width: size * 0.85, height: size * 0.55, borderColor: color, backgroundColor: '#fff', borderRadius: 3 }]}>
        <View style={[styles.lockDot, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

// Sidebar — View puros (sin react-native-svg) acorde a cada funcionalidad

export function IconInbox({ size = 16, color = '#64748b' }: P) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.9, height: size * 0.65, borderWidth: 1.5, borderColor: color, borderRadius: 2, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.55, height: 1.5, backgroundColor: color, borderRadius: 1, marginBottom: 2 }} />
        <View style={{ width: size * 0.4, height: 1.2, backgroundColor: color, opacity: 0.6, borderRadius: 1 }} />
      </View>
      <View style={{ position: 'absolute', top: -1, width: size * 0.5, height: size * 0.22, borderWidth: 1.2, borderColor: color, borderBottomWidth: 0, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: '#fff' }} />
    </View>
  );
}

export function IconPlus({ size = 16, color = '#64748b' }: P) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size * 0.7, height: 1.6, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 1.6, height: size * 0.7, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

export function IconUsers({ size = 16, color = '#64748b' }: P) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 1 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, borderWidth: 1.4, borderColor: color, backgroundColor: '#fff' }} />
        <View style={{ width: size * 0.5, height: size * 0.28, borderWidth: 1.4, borderColor: color, borderTopLeftRadius: 3, borderTopRightRadius: 3, marginTop: 1, backgroundColor: '#fff' }} />
      </View>
      <View style={{ alignItems: 'center', marginLeft: -2, opacity: 0.9 }}>
        <View style={{ width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, borderWidth: 1.2, borderColor: color, backgroundColor: '#fff' }} />
        <View style={{ width: size * 0.42, height: size * 0.24, borderWidth: 1.2, borderColor: color, borderTopLeftRadius: 3, borderTopRightRadius: 3, marginTop: 1, backgroundColor: '#fff' }} />
      </View>
    </View>
  );
}

export function IconLayers({ size = 16, color = '#64748b' }: P) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.8, height: size * 0.28, borderWidth: 1.4, borderColor: color, backgroundColor: '#fff', transform: [{ rotateX: '0deg' }], borderRadius: 1 }} />
      <View style={{ width: size * 0.8, height: size * 0.28, borderWidth: 1.4, borderColor: color, backgroundColor: '#fff', marginTop: -2, borderRadius: 1 }} />
      <View style={{ width: size * 0.8, height: size * 0.28, borderWidth: 1.4, borderColor: color, backgroundColor: '#fff', marginTop: -2, borderRadius: 1 }} />
    </View>
  );
}

export function IconTag({ size = 16, color = '#64748b' }: P) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.62, height: size * 0.62, borderWidth: 1.4, borderColor: color, borderRadius: 2, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
      </View>
    </View>
  );
}

export function IconUpload({ size = 16, color = '#64748b' }: P) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.75, height: size * 0.28, borderWidth: 1.4, borderColor: color, borderTopWidth: 0, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, marginTop: size * 0.35 }} />
      <View style={{ position: 'absolute', top: size * 0.12, width: 1.6, height: size * 0.42, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', top: size * 0.12, width: size * 0.32, height: size * 0.32, borderTopWidth: 1.6, borderLeftWidth: 1.6, borderColor: color, transform: [{ rotate: '45deg' }], backgroundColor: 'transparent' }} />
    </View>
  );
}

// Reloj — círculo + agujas
export function IconClock({ size = 16, color = '#64748b' }: P) {
  const r = size * 0.42;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.88, height: size * 0.88, borderRadius: size * 0.44, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 1.6, height: r * 0.75, backgroundColor: color, borderRadius: 1, top: size * 0.44 - r * 0.75, left: size * 0.44 - 0.8 }} />
        <View style={{ position: 'absolute', width: r * 0.6, height: 1.6, backgroundColor: color, borderRadius: 1, top: size * 0.44 - 0.8, left: size * 0.44 }} />
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

// Mesa / Dependencia — tablero con 4 patas (ícono de mesa)
export function IconTable({ size = 16, color = '#64748b' }: P) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* tablero */}
      <View style={{ width: size * 0.9, height: size * 0.18, borderWidth: 1.4, borderColor: color, borderRadius: 1, backgroundColor: color, opacity: 0.95 }} />
      {/* patas */}
      <View style={{ flexDirection: 'row', width: size * 0.75, justifyContent: 'space-between', marginTop: 1 }}>
        <View style={{ width: 1.6, height: size * 0.45, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 1.6, height: size * 0.45, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 1.6, height: size * 0.45, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 1.6, height: size * 0.45, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyeOuter: { borderWidth: 1.8, alignItems: 'center', justifyContent: 'center' },
  eyeInner: { borderWidth: 1.8 },
  slash: { position: 'absolute', height: 1.8, borderRadius: 1 },
  lockShackle: { borderWidth: 1.6, borderBottomWidth: 0, marginBottom: -2 },
  lockBody: { borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  lockDot: { width: 4, height: 4, borderRadius: 2 },
});
