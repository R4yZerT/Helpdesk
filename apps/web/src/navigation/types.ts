// Tipos de navegacion por stack

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  UpdatePassword: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
  ChangePassword: undefined;
};

export type UsuarioStackParamList = {
  MisSolicitudes: undefined;
  CrearTicket: undefined;
  DetalleTicket: { id: string };
  Perfil: undefined;
};
export type EmpleadoStackParamList = UsuarioStackParamList;

export type TecnicoStackParamList = {
  Bandeja: undefined;
  CrearTicket: undefined;
  DetalleTicket: { id: string };
  Perfil: undefined;
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
  Mesas: undefined; // DEPENDENCIAS (RF-29/30)
  MesaTickets: undefined; // RF replanteo: tickets por dependencia del admin
  DetalleTicket: { id: string }; // destino de la campana RF-23 (oculta del sidebar)
  Categorias: undefined;
  Import: undefined;
  Perfil: undefined;
};
