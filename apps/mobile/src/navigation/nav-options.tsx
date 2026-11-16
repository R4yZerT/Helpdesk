// Opciones de navegación móvil — tokens compartidos + campana local.
import * as React from 'react';
import { APP_HEADER_OPTIONS, APP_TAB_OPTIONS } from '@helpdesk/shared';
import { HeaderBell } from '../components/HeaderBell';

export const screenOpts = {
  ...APP_HEADER_OPTIONS,
  headerRight: () => <HeaderBell />,
};

export const tabOpts = APP_TAB_OPTIONS;
