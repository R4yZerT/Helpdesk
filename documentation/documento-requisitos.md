# Documento de Requisitos — Sistema de Mesa de Ayuda (HelpDesk)

> **Etapa 1 del SLC:** Análisis y Definición de Requisitos.
> Aplicación móvil de mesa de ayuda con modelos predictivos de IA. Usuarios **solo internos** (funcionarios de la empresa (usuarios internos)).

---

## 1. Visión y alcance

Sistema móvil de mesa de ayuda municipal que permite a los usuarios crear y dar seguimiento a solicitudes de soporte, a los técnicos gestionar su bandeja de trabajo y al jefe supervisar la operación en tiempo real, apoyado por modelos de IA que predicen picos de carga, detectan patrones por categoría y alertan anomalías.

**Datos para IA:** provienen de la propia aplicación y de fuentes externas.

**Alcance de la versión 1:** usuario, técnico, jefe y administrador con las funciones descritas en los requisitos funcionales (RF). Stack móvil y backend **aún en análisis** (React Native / Flutter / nativo; Supabase / API propia / Firebase).

---

## 2. Stakeholders y roles

| Rol | Descripción |
|---|---|
| **Usuario** | Crea y da seguimiento a sus solicitudes (funcionario solicitante), recibe notificaciones de cambios de estado. |
| **Técnico** | Gestiona la bandeja de tickets asignados, cambia estados, resuelve solicitudes y comenta. |
| **Jefe** | Supervisa la operación en tiempo real mediante dashboard con filtros y recibe alertas del sistema de IA. |
| **Administrador** | Crea usuarios, asigna roles y mesas, gestiona las mesas y el catálogo de categorías. No gestiona tickets ni recibe alertas de IA. |

---

## 3. Requisitos funcionales

### Módulo 1 — Autenticación y seguridad

| ID | Requisito | Prio |
|---|---|---|
| RF-01 | Inicio de sesión del usuario con correo corporativo + contraseña siguiendo NIST SP 800-63B (mín. 8 chars, sin composición forzada, check contra listas de contraseñas comprometidas) | M |
| RF-02 | Modales de confirmación/error tras cada creación o modificación | M |
| RF-03 | Cambio y recuperación de contraseña con validación de la política segura en el front | M |
| RF-04 | Sesión persistente con token (JWT) y cierre de sesión | M |
| RF-05 | Control de acceso por rol: **usuario**, **técnico**, **jefe**, **administrador** | M |

### Módulo 2 — Gestión de tickets

| ID | Requisito | Prio |
|---|---|---|
| RF-06 | Crear solicitud de mesa de ayuda (categoría, asunto, descripción, prioridad, dependencia) | M |
| RF-07 | Adjuntar imágenes/documentos a la solicitud | S |
| RF-08 | Listado de "mis solicitudes" con estado, filtros y búsqueda | M |
| RF-09 | Ver detalle de una solicitud con historial de estados y comentarios | M |
| RF-10 | Editar o cancelar una solicitud propia mientras no esté asignada | S |
| RF-11 | Registro de **fecha/hora de resolución** y solución aplicada (dato clave para IA) | M |

### Módulo 3 — Flujo de trabajo del técnico

| ID | Requisito | Prio |
|---|---|---|
| RF-12 | Bandeja de tickets asignados al técnico con orden por prioridad/antigüedad | M |
| RF-13 | Transiciones de estado: Abierto → En Proceso → Solucionado / Cerrado / Devuelto / Programado | M |
| RF-14 | Reasignar ticket a otro técnico o mesa | M |
| RF-15 | Comentarios internos (técnico ↔ usuario) visibles en el detalle | M |

### Módulo 4 — Dashboard del jefe (tiempo real)

| ID | Requisito | Prio |
|---|---|---|
| RF-16 | Dashboard en tiempo real: volumen, estado, prioridad, tiempos de resolución | M |
| RF-17 | Filtros combinables por dependencia, técnico, categoría, prioridad, estado y rango de fechas | M |
| RF-18 | Exportación de reportes (PDF/CSV) del dashboard filtrado | S |

### Módulo 5 — IA predictiva

| ID | Requisito | Prio |
|---|---|---|
| RF-19 | Predecir picos de carga por hora/día/mes por mesa y dependencia | S |
| RF-20 | Detectar patrones de demanda por categoría normalizada (usa la tabla maestra `ticket_categories`) | S |
| RF-21 | Alertar anomalías: picos inusuales y tickets estancados (sin resolver > X días) | S |
| RF-22 | Sugerencia automática de categoría/prioridad al crear ticket (modelo supervisado) | C |

### Módulo 6 — Notificaciones y catálogos

| ID | Requisito | Prio |
|---|---|---|
| RF-23 | Notificaciones push al usuario ante cambios de estado | S |
| RF-24 | Alertas del sistema de IA dirigidas al jefe | S |
| RF-25 | Administración de catálogos: categorías, dependencias, técnicos | S |
| RF-26 | Importación del histórico CSV normalizado (latin-1 → UTF-8, NFD) como datos de entrenamiento | M |

### Módulo 7 — Administración (rol administrador)

| ID | Requisito | Prio |
|---|---|---|
| RF-27 | Crear, editar y desactivar usuarios del sistema (usuarios solicitantes, técnicos, jefes) | M |
| RF-28 | Asignar y reasignar a cada usuario su rol y su mesa | M |
| RF-29 | Crear y gestionar las **mesas** (dependencias: TIC, Comunicaciones, Infraestructura Física, EAPSA, etc.) | M |
| RF-30 | Ver **todas** las mesas y su configuración, independientemente de su cargo | M |
| RF-31 | Asignar técnicos a mesas y definir mesas de respaldo | S |
| RF-32 | Gestionar el catálogo de categorías normalizadas (`ticket_categories`) | S |

**Totales: 32 RF** (14 Must, 17 Should, 1 Could).

---

## 4. Modelo de datos (inicial)

### Tabla maestra: categorías normalizadas

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador |
| `dominio` | text | `tic`, `comunicaciones`, `infraestructura`, `general` |
| `subcategoria` | text | Subcategoría normalizada |
| `orden` | int | Orden de presentación |
| `activa` | boolean | Habilita/deshabilita la categoría |
| `creado_en` | timestamptz | Marca temporal de creación |

`unique (dominio, subcategoria)`.

### Catálogo de subcategorías por dominio

**TIC (tic):**
1. Gestión de usuarios
2. Permisos y accesos
3. Contraseñas y seguridad
4. Correo electrónico
5. Conectividad y redes
6. Equipos y hardware
7. Impresoras y escáneres
8. Software y aplicaciones
9. Datos y respaldos
10. Soporte y aplicaciones institucionales

**Comunicaciones (comunicaciones):**
1. Piezas gráficas y diseño
2. Audiovisual
3. Web y publicaciones
4. Eventos y branding

**Infraestructura (infraestructura):**
1. Eléctrica
2. Hidrosanitaria
3. Carpintería y mobiliario
4. Obra civil y mantenimiento locativo

**General (general):**
1. Sin clasificar / Otros

### Mapeo de tipos de ticket históricos → categorías

**Dominio TIC:**
- **Gestión de usuarios:** Creación de usuario; Creación de usuarios; Creación / Activación de usuarios; Activación de usuario; Habilitación de usuario; Desbloqueo de usuario; Deshabilitación de usuario; Eliminación de usuario
- **Permisos y accesos:** Permisos de acceso; Solicitud de permisos de acceso; Permiso de acceso a sitio web
- **Contraseñas y seguridad:** Cambio de contraseña; Verificar correo sospechoso; Seguridad de Sophos E-mail; Reporte de Virus
- **Correo electrónico:** Configuración de Outlook
- **Conectividad y redes:** Sin Internet; Sin servicio de Internet; Internet Lento; Conexión a WIFI; Instalación de WIFI; Falla de punto de red; Cable de red; Instalación puntos de red; Instalación punto de red nuevo; Telefonía IP; Teléfono no funciona; Reconfiguración de VPN; Creación de VPN
- **Equipos y hardware:** Equipo no prende; No enciende; Sistema lento; Formatear equipo; Mantenimiento; Mantenimiento preventivo; Mover equipo de puesto de trabajo; Traslado de equipos; Baja de equipos; Salida de equipos; Instalación de periféricos; Otros equipos de oficina
- **Impresoras y escáneres:** No imprime; Atasco de papel; Cambio de tonner; Muestra error (impresora)
- **Software y aplicaciones:** Instalación de software; Reinstalación de software; Instalación del sistema; Desinstalación de software; Actualización de software; Actualización de módulos; Configuración; Configuración de Software; Mantenimiento de software; Análisis de errores; Error de acceso al sistema; Mejora/Modificación al sistema; Solicitud de nuevos requerimientos
- **Datos y respaldos:** Backup y respaldo de información; Copias de bases de datos
- **Soporte y aplicaciones institucionales:** Soporte; Soporte / Capacitación; Creación de carpetas; Creación de espacios de información; Actualización de información; Actualzación de información; Solicitud de información / Reporte; Acompañamiento para rendición de informes; Consultas de información

**Dominio Comunicaciones:**
- **Piezas gráficas y diseño:** Pieza Gráfica invitación/historia/efeméride; Diseño de impresos gran formato; Diseño de presentaciones PPT; Fondo de pantalla; Placas/reconocimientos/certificados; Carrusel; Carrusel texto y video
- **Audiovisual:** Acompañamiento / Cubrimiento; Reel; Edición foto/video/pieza editorial; Video Campaña; Tomas Dron; Presentador / Animador
- **Web y publicaciones:** Solicitud de publicación
- **Eventos y branding:** Branding y eventos faldón/Roll up/backing virtual/habladores; Préstamo bandera/atril/roll up/dummie/himnos; Souvenirs; Apoyo logístico con personal; Préstamo de volqueta; Préstamo de herramientas o equipos

**Dominio Infraestructura:**
- **Eléctrica:** Reparación o cambio de luminarias; Reparación de redes eléctricas; Reparación o instalación de tomas
- **Hidrosanitaria:** Fugas de agua en baños; Reparación de Greca; Griferías en mal estado; Reparación o limpieza de canoas; Daños en redes de acueducto; Llaves de pocetas dañadas; Lavamanos o pocetas obstruidos; Baños obstruidos; Reparación o limpieza de bajantes; MH (Man Hole) obstruidos; Limpieza de cunetas
- **Carpintería y mobiliario:** Sillas; Mesas; Archivadores; Estanterías; Reparación de mesas o escritorios de madera; Reparación e instalación de chapas; Chapas para escritorios/puertas de madera; Instalación de puertas de madera/metálicas; Reparación de ventanería/ventanas; Traslado de mobiliario
- **Obra civil y mantenimiento:** Pintura; Reparación de goteras; Humedad; Soldadura; Cerramiento temporal; Vaciados de pisos en concreto; Mantenimiento de adoquines o franja táctil; Pasamanos; Rejas; Huecos en la vía; Instalación de muros en drywall; Instalación de enchapes en pisos y muros; Muros o divisiones en ladrillo; Instalación/reubicación de divisiones modulares

**Dominio General:**
- **Sin clasificar / Otros:** N/A; Traslado e instalación de carpa

> **Nota de calidad:** el histórico `tickets_2026-08-04_19-36-29.csv` (7083 tickets) está en **latin-1 con doble codificación**. Al cargarlo aplicar normalización NFD (U+0300-U+036f: quitar marcas de combinación) y el diccionario debe vivir como tabla maestra `ticket_categories`, no como free-text.

---

## 5. Datos de referencia del histórico (para entrenamiento IA)

- **Estados:** Solucionado 59.9%, Cerrado 33.3%, Abierto 5.4%, En Proceso 0.6%, Devuelto 0.5%, Programado 0.3%.
- **Prioridades:** Media 60.6% · Alta 24.0% · Crítica 11.3% · Baja 4.1%.
- **Dependencias/mesas:** Oficina TIC 50.4%, Comunicaciones 37.2%, Infraestructura Física 7.9%, EAPSA 1.9%, Servicios Administrativos 1.7%, otros.
- **Pico de volumen:** 08:00-13:00 (hora 11 máx. 1057 tickets).
- **Estacionalidad:** diciembre bajo (385), febrero pico (932).
- **Campo faltante en histórico:** fecha/hora de resolución (a capturar en el nuevo sistema).