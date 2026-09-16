// Compartir CSV en móvil nativo vía hoja de compartir del sistema (RF-18).
// En web se usa downloadCsv del shared (descarga directa); este helper solo cubre iOS/Android.
// Require diferido: evita romper el bundle en plataformas sin soporte nativo (web, Expo Go parcial).
import { Platform } from 'react-native';

export async function shareCsvNativo(filename: string, csv: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sharing = require('expo-sharing') as typeof import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) return false;
    const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? null;
    if (!base) return false;
    const uri = `${base}${filename}`;
    await FileSystem.writeAsStringAsync(uri, csv); // UTF-8 por defecto
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: filename });
    return true;
  } catch (e) {
    console.warn('[shareCsv] compartir nativo no disponible', e);
    return false;
  }
}
