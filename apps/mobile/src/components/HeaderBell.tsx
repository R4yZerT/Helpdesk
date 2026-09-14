// RF-23 móvil — Campana de notificaciones en headers nativos.
// Envuelve NotificationBell de shared; al abrir ticket navega a DetalleTicket si la ruta existe.
import * as React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NotificationBell } from '@helpdesk/shared';
import { supabase } from '../lib/supabase';

export function HeaderBell() {
  const navigation = useNavigation();
  const onOpenTicket = React.useCallback((id: string) => {
    try {
      (navigation as unknown as { navigate: (r: string, p?: object) => void }).navigate('DetalleTicket', { id });
    } catch {
      // La pila actual no tiene detalle (ej. jefe): la campana igual marca leída.
    }
  }, [navigation]);
  return (
    <View style={{ marginRight: 4 }}>
      <NotificationBell client={supabase as never} onOpenTicket={onOpenTicket} />
    </View>
  );
}
