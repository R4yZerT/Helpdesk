// RF-23 móvil — Campana de notificaciones en headers nativos.
// Envuelve NotificationBell de shared; al abrir ticket navega a DetalleTicket.
// 1.º intento local (preserva el tab); si la pila no tiene detalle, fallback
// por tab anidado vía navigationRef (headers de Tab sin DetalleTicket directo).
import * as React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NotificationBell } from '@helpdesk/shared';
import { supabase } from '../lib/supabase';
import { abrirTicketDesdeCampana, abrirTicketLocal } from '../navigation/navigationRef';

export function HeaderBell() {
  const navigation = useNavigation();
  const onOpenTicket = React.useCallback((id: string) => {
    if (abrirTicketLocal(navigation, id)) return;
    abrirTicketDesdeCampana(id);
  }, [navigation]);
  return (
    <View style={{ marginRight: 4 }}>
      <NotificationBell client={supabase as never} onOpenTicket={onOpenTicket} />
    </View>
  );
}
