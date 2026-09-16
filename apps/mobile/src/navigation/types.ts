// Tipos de navegacion por stack

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  UpdatePassword: undefined;
  ChangePassword: undefined;
};

export type UsuarioStackParamList = {
  MisSolicitudes: undefined;
  CrearTicket: undefined;
  DetalleTicket: { id: string };
};
// Alias compatibilidad
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type EmpleadoStackParamList = UsuarioStackParamList;

export type TecnicoStackParamList = {
  Bandeja: undefined;
  CrearTicket: undefined;
  DetalleTicket: { id: string };
};

export type JefeStackParamList = {
  Dashboard: undefined;
  CrearTicket: undefined;
  DetalleTicket: { id: string };
  Reportes: undefined;
  Alertas: undefined;
  Perfil: undefined;
};

export type AdminStackParamList = {
  Usuarios: undefined;
  Mesas: undefined;
  MesaTickets: undefined;
  DetalleTicket: { id: string };
  Categorias: undefined;
  Import: undefined;
  Perfil: undefined;
};
