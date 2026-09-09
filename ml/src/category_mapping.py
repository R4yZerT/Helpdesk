# Mapeo de Tipo de Ticket legacy (139 valores) -> ticket_categories nuevo (19)
# Dominio + Subcategoria según supabase/migrations/20260820150246_ticket_categories.sql
# La nueva mesa solo usa categoria_id (FK a ticket_categories.id), por eso mapeamos a (dominio, subcategoria)

# Clave: valor exacto de "Tipo de Ticket" en el CSV (latin1 ya decodificado)
# Valor: (dominio, subcategoria) — debe existir en ticket_categories
CATEGORY_MAP: dict[str, tuple[str, str]] = {
    # ── TIC: Gestión de usuarios ──
    "Activacion de usuario": ("tic", "Gestión de usuarios"),
    "Creación de usuario": ("tic", "Gestión de usuarios"),
    "Creación / Activación de usuarios": ("tic", "Gestión de usuarios"),
    "Habilitación de usuario": ("tic", "Gestión de usuarios"),
    "Desbloqueo de usuario": ("tic", "Gestión de usuarios"),
    "Deshabilitación de usuario": ("tic", "Gestión de usuarios"),
    "Eliminación de usuario": ("tic", "Gestión de usuarios"),
    # ── TIC: Permisos y accesos ──
    "Permisos de acceso": ("tic", "Permisos y accesos"),
    "Permiso de acceso a sitio web": ("tic", "Permisos y accesos"),
    "Solicitud de permisos de acceso": ("tic", "Permisos y accesos"),
    # ── TIC: Contraseñas y seguridad ──
    "Cambio de contraseña": ("tic", "Contraseñas y seguridad"),
    "Reporte de Virus": ("tic", "Contraseñas y seguridad"),
    "Seguridad de Sophos E-mail": ("tic", "Contraseñas y seguridad"),
    "Verificar correo sospechoso": ("tic", "Contraseñas y seguridad"),
    # ── TIC: Correo electrónico ──
    "Configuración de outlook": ("tic", "Correo electrónico"),
    # ── TIC: Conectividad y redes ──
    "Sin Internet": ("tic", "Conectividad y redes"),
    "Sin servicio de Internet": ("tic", "Conectividad y redes"),
    "Internet Lento": ("tic", "Conectividad y redes"),
    "Falla de punto de red": ("tic", "Conectividad y redes"),
    "ConexiÃ³n a WIFI": ("tic", "Conectividad y redes"),
    "Conexión a WIFI": ("tic", "Conectividad y redes"),
    "Instalación de WIFI": ("tic", "Conectividad y redes"),
    "Cable de red": ("tic", "Conectividad y redes"),
    "Instalacion puntos de red": ("tic", "Conectividad y redes"),
    "Instalación punto de red nuevo": ("tic", "Conectividad y redes"),
    "Reconfiguración de VPN": ("tic", "Conectividad y redes"),
    "Creación de VPN": ("tic", "Conectividad y redes"),
    # ── TIC: Equipos y hardware ──
    "Equipo no prende": ("tic", "Equipos y hardware"),
    "No enciende": ("tic", "Equipos y hardware"),
    "Sistema lento": ("tic", "Equipos y hardware"),
    "Muestra error": ("tic", "Equipos y hardware"),
    "Mantenimiento": ("tic", "Equipos y hardware"),
    "Mantenimiento preventivo": ("tic", "Equipos y hardware"),
    "Formatear equipo": ("tic", "Equipos y hardware"),
    "Mover equipo de puesto de trabajo": ("tic", "Equipos y hardware"),
    "Traslado de equipos": ("tic", "Equipos y hardware"),
    "Instalación de periféricos": ("tic", "Equipos y hardware"),
    "Fondo de pantalla": ("tic", "Equipos y hardware"),
    "Telefonia IP": ("tic", "Equipos y hardware"),
    "Teléfono no funciona": ("tic", "Equipos y hardware"),
    "Otros equipos de oficina (no equipos de cómputo ni periféricos)": ("tic", "Equipos y hardware"),
    "Salida de equipos": ("tic", "Equipos y hardware"),
    "Baja de equipos": ("tic", "Equipos y hardware"),
    "Mantenimiento de equipos mecánicos": ("tic", "Equipos y hardware"),
    # ── TIC: Impresoras y escáneres ──
    "Atasco de papel": ("tic", "Impresoras y escáneres"),
    "No imprime": ("tic", "Impresoras y escáneres"),
    "Cambio de tonner": ("tic", "Impresoras y escáneres"),
    # ── TIC: Software y aplicaciones ──
    "Instalación": ("tic", "Software y aplicaciones"),
    "Instalación de software": ("tic", "Software y aplicaciones"),
    "Configuracion de Software": ("tic", "Software y aplicaciones"),
    "Configuración": ("tic", "Software y aplicaciones"),
    "Actualización de software": ("tic", "Software y aplicaciones"),
    "Actualzación de información": ("tic", "Software y aplicaciones"),
    "Actualización de información": ("tic", "Software y aplicaciones"),
    "Actualización de módulos": ("tic", "Software y aplicaciones"),
    "Instalación del sistema": ("tic", "Software y aplicaciones"),
    "Reinstalación de software": ("tic", "Software y aplicaciones"),
    "Desinstalación de software": ("tic", "Software y aplicaciones"),
    "Mantenimiento de software": ("tic", "Software y aplicaciones"),
    "Creación de carpetas": ("tic", "Software y aplicaciones"),
    "Análisis de errores": ("tic", "Software y aplicaciones"),
    "Error de acceso al sistema": ("tic", "Software y aplicaciones"),
    "Error en el sistema": ("tic", "Software y aplicaciones"),
    "Mejora / Modificación al sistema": ("tic", "Software y aplicaciones"),
    "Solicitud de nuevos requerimientos": ("tic", "Software y aplicaciones"),
    "Solicitud de Información / Reporte": ("tic", "Software y aplicaciones"),
    "Solicitud de información / Reporte": ("tic", "Software y aplicaciones"),
    "Consultas de información": ("tic", "Software y aplicaciones"),
    "Copias de bases de datos": ("tic", "Software y aplicaciones"),
    # ── TIC: Datos y respaldos ──
    "Backup y respaldo de información": ("tic", "Datos y respaldos"),
    # ── TIC: Soporte y aplicaciones institucionales ──
    "Soporte": ("tic", "Soporte y aplicaciones institucionales"),
    "Soporte / Capacitación": ("tic", "Soporte y aplicaciones institucionales"),
    # ── Comunicaciones: Piezas gráficas ──
    "Pieza Gráfica invitación/historia/efeméride": ("comunicaciones", "Piezas gráficas y diseño"),
    "Reel": ("comunicaciones", "Piezas gráficas y diseño"),
    "Carrusel": ("comunicaciones", "Piezas gráficas y diseño"),
    "Carrusel texto y video": ("comunicaciones", "Piezas gráficas y diseño"),
    "Edición foto/video/pieza editorial": ("comunicaciones", "Piezas gráficas y diseño"),
    "Diseño de impresos gran formato": ("comunicaciones", "Piezas gráficas y diseño"),
    "Placas /reconocimientos/ certificados": ("comunicaciones", "Piezas gráficas y diseño"),
    "Diseño de presentaciones ppt": ("comunicaciones", "Piezas gráficas y diseño"),
    # ── Comunicaciones: Audiovisual ──
    "Acompañamiento / Cubrimiento": ("comunicaciones", "Audiovisual"),
    "Tomas Dron": ("comunicaciones", "Audiovisual"),
    "Presentador/ Animador": ("comunicaciones", "Audiovisual"),
    # ── Comunicaciones: Web y publicaciones ──
    "Solicitud de publicación": ("comunicaciones", "Web y publicaciones"),
    "Creación de espacios de información": ("comunicaciones", "Web y publicaciones"),
    "Video Campaña": ("comunicaciones", "Web y publicaciones"),
    # ── Comunicaciones: Eventos y branding ──
    "Branding y eventos faldón/Roll up/backing virtual/habladores": ("comunicaciones", "Eventos y branding"),
    "Préstamo bandera/atril/roll up/dummie/himnos": ("comunicaciones", "Eventos y branding"),
    "Apoyo logístico con personal": ("comunicaciones", "Eventos y branding"),
    "Souvenirs": ("comunicaciones", "Eventos y branding"),
    "Préstamo de volqueta": ("comunicaciones", "Eventos y branding"),
    # ── Infraestructura: Eléctrica ──
    "Reparación de redes eléctricas": ("infraestructura", "Eléctrica"),
    "Reparación o cambio de luminarias": ("infraestructura", "Eléctrica"),
    "Reparación o instalación de tomas": ("infraestructura", "Eléctrica"),
    "Reparación o instalación de switches": ("infraestructura", "Eléctrica"),
    "Instalación o reparación de puertas metálicas": ("infraestructura", "Eléctrica"),
    "Instalación o reparación de ventanería metálica": ("infraestructura", "Eléctrica"),
    "Instalación o reparación de ventanas de madera": ("infraestructura", "Eléctrica"),
    # ── Infraestructura: Hidrosanitaria ──
    "Fugas de agua en baños": ("infraestructura", "Hidrosanitaria"),
    "Griferías en mal estado": ("infraestructura", "Hidrosanitaria"),
    "Baños obstruidos": ("infraestructura", "Hidrosanitaria"),
    "Llaves de pocetas malas": ("infraestructura", "Hidrosanitaria"),
    "Lavamanos o pocetas obstruidos": ("infraestructura", "Hidrosanitaria"),
    "Daños en redes de acueducto": ("infraestructura", "Hidrosanitaria"),
    "Reparación o limpieza de canoas": ("infraestructura", "Hidrosanitaria"),
    "Reparación o limpieza de bajantes": ("infraestructura", "Hidrosanitaria"),
    "MH (Man Hole) Obstruidos o levantados": ("infraestructura", "Hidrosanitaria"),
    "Limpieza de cunetas": ("infraestructura", "Hidrosanitaria"),
    "Humedad": ("infraestructura", "Hidrosanitaria"),
    "Repración de goteras": ("infraestructura", "Hidrosanitaria"),
    # ── Infraestructura: Carpintería y mobiliario ──
    "Sillas": ("infraestructura", "Carpintería y mobiliario"),
    "Mesas": ("infraestructura", "Carpintería y mobiliario"),
    "Archivadores": ("infraestructura", "Carpintería y mobiliario"),
    "Estanterías": ("infraestructura", "Carpintería y mobiliario"),
    "Instalación o reparación de chapas": ("infraestructura", "Carpintería y mobiliario"),
    "Instalación o reparación de chapas para escritorios de madera": ("infraestructura", "Carpintería y mobiliario"),
    "Instalación o reparación de chapas para puertas de madera": ("infraestructura", "Carpintería y mobiliario"),
    "Instalación o reparación de puertas de madera": ("infraestructura", "Carpintería y mobiliario"),
    "Reparación de mesas o escritorios de madera": ("infraestructura", "Carpintería y mobiliario"),
    "Instalación o reparación de estanterías de madera": ("infraestructura", "Carpintería y mobiliario"),
    "Traslado de mobiliario": ("infraestructura", "Carpintería y mobiliario"),
    "Instalación o reubicación de divisiones modulares": ("infraestructura", "Carpintería y mobiliario"),
    "Instalación de muros en drywall": ("infraestructura", "Carpintería y mobiliario"),
    # ── Infraestructura: Obra civil ──
    "Pintura": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Muros o divisiones en ladrillo": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Instalación de enchapes en pisos y muros": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Vaciados de pisos en concreto": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Mantenimiento en adoquines o franja táctil": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Fractura de andenes o rebajes para personas con movilidad reducida": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Huecos en la vía": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Rejas": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Pasamanos": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Cerramiento temporal": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Soldadura": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Limpieza": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Traslado e instalación de carpa": ("infraestructura", "Obra civil y mantenimiento locativo"),
    "Préstamo de herramientas o equipos": ("infraestructura", "Obra civil y mantenimiento locativo"),
    # ── General (residual - será reclasificado, no debe permanecer en dataset final) ──
    "N/A": ("general", "Sin clasificar / Otros"),
    # Nota: "Otros equipos de oficina..." ya mapeado arriba a Equipos y hardware (no duplicar)
}

# ── Consolidación 19 → 14 clases macro (optimización MLOps) ──
# Unifica ramas TIC con alta superposición léxica
CONSOLIDATED_MAP: dict[tuple[str, str], tuple[str, str]] = {
    ("tic", "Gestión de usuarios"): ("tic", "Gestión de Accesos y Seguridad"),
    ("tic", "Permisos y accesos"): ("tic", "Gestión de Accesos y Seguridad"),
    ("tic", "Contraseñas y seguridad"): ("tic", "Gestión de Accesos y Seguridad"),
    ("tic", "Software y aplicaciones"): ("tic", "Software y Sistemas"),
    ("tic", "Soporte y aplicaciones institucionales"): ("tic", "Software y Sistemas"),
    ("tic", "Equipos y hardware"): ("tic", "Equipos e Infraestructura"),
    ("tic", "Impresoras y escáneres"): ("tic", "Equipos e Infraestructura"),
    ("tic", "Datos y respaldos"): ("tic", "Equipos e Infraestructura"),
}

# Mapeo string → string para uso directo en DataFrames (notebook)
CONSOLIDATED_LABEL_MAP: dict[str, str] = {
    "tic:Gestión de usuarios": "tic:Gestión de Accesos y Seguridad",
    "tic:Permisos y accesos": "tic:Gestión de Accesos y Seguridad",
    "tic:Contraseñas y seguridad": "tic:Gestión de Accesos y Seguridad",
    "tic:Software y aplicaciones": "tic:Software y Sistemas",
    "tic:Soporte y aplicaciones institucionales": "tic:Software y Sistemas",
    "tic:Equipos y hardware": "tic:Equipos e Infraestructura",
    "tic:Impresoras y escáneres": "tic:Equipos e Infraestructura",
    "tic:Datos y respaldos": "tic:Equipos e Infraestructura",
}

# Fallback por keywords si el tipo no está mapeado (casos con typos raros)
# Nota: ya apuntan a categorías consolidadas (13 finales)
FALLBACK_KEYWORDS: list[tuple[str, tuple[str, str]]] = [
    ("pieza gráfica", ("comunicaciones", "Piezas gráficas y diseño")),
    ("reel", ("comunicaciones", "Piezas gráficas y diseño")),
    ("carrusel", ("comunicaciones", "Piezas gráficas y diseño")),
    ("branding", ("comunicaciones", "Eventos y branding")),
    ("cubrimiento", ("comunicaciones", "Audiovisual")),
    ("dron", ("comunicaciones", "Audiovisual")),
    ("publicación", ("comunicaciones", "Web y publicaciones")),
    ("correo", ("tic", "Correo electrónico")),
    ("outlook", ("tic", "Correo electrónico")),
    ("vpn", ("tic", "Conectividad y redes")),
    ("wifi", ("tic", "Conectividad y redes")),
    ("internet", ("tic", "Conectividad y redes")),
    ("impresora", ("tic", "Equipos e Infraestructura")),
    ("tonner", ("tic", "Equipos e Infraestructura")),
    ("atasco", ("tic", "Equipos e Infraestructura")),
    ("backup", ("tic", "Equipos e Infraestructura")),
    ("respaldo", ("tic", "Equipos e Infraestructura")),
    ("contraseña", ("tic", "Gestión de Accesos y Seguridad")),
    ("permiso", ("tic", "Gestión de Accesos y Seguridad")),
    ("usuario", ("tic", "Gestión de Accesos y Seguridad")),
    ("software", ("tic", "Software y Sistemas")),
    ("sistema", ("tic", "Software y Sistemas")),
    ("aplicacion", ("tic", "Software y Sistemas")),
    ("luminaria", ("infraestructura", "Eléctrica")),
    ("eléctrica", ("infraestructura", "Eléctrica")),
    ("fuga", ("infraestructura", "Hidrosanitaria")),
    ("baño", ("infraestructura", "Hidrosanitaria")),
    ("silla", ("infraestructura", "Carpintería y mobiliario")),
    ("mesa", ("infraestructura", "Carpintería y mobiliario")),
    ("chapa", ("infraestructura", "Carpintería y mobiliario")),
    ("pintura", ("infraestructura", "Obra civil y mantenimiento locativo")),
    ("muro", ("infraestructura", "Obra civil y mantenimiento locativo")),
]

# Reglas de reclasificación inteligente para categoría residual
# Cuando texto es genérico, se distribuye a las áreas transversales más probables
GENERAL_RECLASSIFICATION_RULES: list[tuple[str, tuple[str, str]]] = [
    ("software", ("tic", "Software y Sistemas")),
    ("sistema", ("tic", "Software y Sistemas")),
    ("aplicacion", ("tic", "Software y Sistemas")),
    ("plataforma", ("tic", "Software y Sistemas")),
    ("equipo", ("tic", "Equipos e Infraestructura")),
    ("computador", ("tic", "Equipos e Infraestructura")),
    ("impresora", ("tic", "Equipos e Infraestructura")),
    ("hardware", ("tic", "Equipos e Infraestructura")),
    ("red", ("tic", "Conectividad y redes")),
    ("internet", ("tic", "Conectividad y redes")),
    ("correo", ("tic", "Correo electrónico")),
]



import unicodedata, re

def _apply_consolidation(cat: tuple[str, str]) -> tuple[str, str]:
    """Aplica consolidación 19→14 si existe mapping."""
    return CONSOLIDATED_MAP.get(cat, cat)

def _reclassify_general(texto: str) -> tuple[str, str]:
    """Reclasificación inteligente de tickets residuales basándose en contenido léxico.
    Elimina el comodín forzando asignación a 13 clases estrictas."""
    if not texto:
        return ("tic", "Software y Sistemas")  # fallback transversal
    norm_text = _norm(texto)
    for kw, cat in GENERAL_RECLASSIFICATION_RULES:
        if _norm(kw) in norm_text:
            return cat
    # fallback por fallback keywords consolidados
    for kw_norm, cat in _NORM_FALLBACK:
        if kw_norm in norm_text:
            return _apply_consolidation(cat)
    # último fallback: área transversal más frecuente
    return ("tic", "Software y Sistemas")

def _norm(s: str) -> str:
    s = s.replace("\ufeff","").replace("ï»¿","").strip()
    # reparar mojibake Ã -> utf8
    if "Ã" in s:
        try:
            s = s.encode("latin1").decode("utf-8")
        except: pass
    # quitar �
    s = s.replace("�","").replace("�","")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s

# índice normalizado para matching robusto
_NORM_MAP = {_norm(k): v for k, v in CATEGORY_MAP.items()}
_NORM_FALLBACK = [(_norm(kw), cat) for kw, cat in FALLBACK_KEYWORDS]

def resolve_category(tipo_raw: str, texto: str | None = None) -> tuple[str, str]:
    """Resuelve (dominio, subcategoria) robusto a mojibake y acentos.
    Aplica consolidación 19→14 y reclasificación inteligente del comodín.
    Args:
        tipo_raw: valor de 'Tipo de Ticket' del CSV
        texto: texto combinado opcional para reclasificar categoría general
    """
    if not tipo_raw or not tipo_raw.strip():
        cat = ("general", "Sin clasificar / Otros")
    else:
        key = tipo_raw.strip()
        cat = None
        if key in CATEGORY_MAP:
            cat = CATEGORY_MAP[key]
        else:
            nk = _norm(key)
            if nk in _NORM_MAP:
                cat = _NORM_MAP[nk]
            else:
                # fallback por keywords normalizados
                for kw_norm, c in _NORM_FALLBACK:
                    if kw_norm in nk:
                        cat = c
                        break
                if cat is None:
                    low = key.lower()
                    for kw, c in FALLBACK_KEYWORDS:
                        if kw in low:
                            cat = c
                            break
                if cat is None:
                    cat = ("general", "Sin clasificar / Otros")
    # aplicar consolidación 19→14
    cat = _apply_consolidation(cat)
    # eliminar comodín: redistribuir si aún es general
    if cat[0] == "general" and cat[1] == "Sin clasificar / Otros":
        if texto:
            return _reclassify_general(texto)
        # sin texto, mantener general temporalmente (será filtrado en cleaning.py)
        return cat
    return cat
