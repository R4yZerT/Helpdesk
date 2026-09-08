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

const styles = StyleSheet.create({
  eyeOuter: { borderWidth: 1.8, alignItems: 'center', justifyContent: 'center' },
  eyeInner: { borderWidth: 1.8 },
  slash: { position: 'absolute', height: 1.8, borderRadius: 1 },
  lockShackle: { borderWidth: 1.6, borderBottomWidth: 0, marginBottom: -2 },
  lockBody: { borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  lockDot: { width: 4, height: 4, borderRadius: 2 },
});
