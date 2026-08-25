// Tipos de navegacion por stack

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ChangePassword: undefined;
};

export type EmpleadoStackParamList = {
  MisSolicitudes: undefined;
  CrearTicket: undefined;
  DetalleTicket: { id: string };
};

export type TecnicoStackParamList = {
  Bandeja: undefined;
  CrearTicket: undefined;
  DetalleTicket: { id: string };
};

export type JefeStackParamList = {
  Dashboard: undefined;
  CrearTicket: undefined;
  Reportes: undefined;
  Alertas: undefined;
};

export type AdminStackParamList = {
  Usuarios: undefined;
  Mesas: undefined;
  Categorias: undefined;
  Import: undefined;
};
