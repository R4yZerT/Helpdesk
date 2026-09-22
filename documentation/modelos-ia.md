# Modelos de IA del HelpDesk

Dos modelos de ML clásico conviven en el sistema. Ninguno toma decisiones solo:
la IA **sugiere**, el humano **confirma**.

> Nota de terminología: donde este documento dice "crear un ticket en mesa",
> se refiere a la pantalla de creación de tickets, que es donde la IA sugiere
> la dependencia (mesa), la categoría y la prioridad.

---

## 1. Recomendador de categoría al crear tickets (BETO)

### Qué hace

Cuando el usuario escribe el asunto + descripción (mínimo 20 caracteres),
la app sugiere automáticamente **dependencia (mesa) + categoría + prioridad**.
Nunca sugiere técnico: el ticket entra a la cola de la dependencia.
La sugerencia es editable; si el usuario elige manualmente, su elección manda.

### Modelo

- **Arquitectura**: BETO (`dccuchile/bert-base-spanish-wwm-cased`, 110M parámetros),
  fine-tune para clasificación de secuencias.
- **Clases**: 13 categorías consolidadas (`dominio:subcategoria`), sin el comodín
  `general:Sin clasificar / Otros`. El notebook (`02_train_beto_colab.ipynb`,
  celda 6) aplica `mapping_consolidation` (8 entradas: Gestión de
  usuarios/Permisos/Contraseñas → Gestión de Accesos y Seguridad; Software y
  aplicaciones/Soporte institucional → Software y Sistemas;
  Datos/Impresoras/Equipos y hardware → Equipos e Infraestructura) y filtra
  las filas comodín. En `ml/src/cleaning.py` el comodín se reclasifica por
  contenido léxico (`category_mapping._reclassify_general`) o se filtra.
- **Datos**: `data/processed/tickets_clean.parquet` (7928 filas, texto +
  `label_id`), generados por `ml/src/cleaning.py` desde el CSV histórico (RF-26).
  Distribución: Piezas gráficas 2087, Accesos 1197, Equipos 1038, Software 1005,
  Audiovisual 672, Conectividad 443, Correo 278, Eventos 265, Web 247,
  Carpintería 246, Eléctrica 179, Hidrosanitaria 177, Obra civil 94.
  Desbalance mayoritaria/menor ≈ 22× (2087/94).
- **Entrenamiento** (`ml/src/train_beto.py`, réplica local del notebook):
  split estratificado 80/10/10 y **augmentation solo en train** (sinónimos
  usuario/cuenta/colaborador, falla/error/problema, acceso/entrada/ingreso,
  equipo/pc/computador; clases con < 80 filas, ×2 por fila → train 6492 /
  val 793 / test 793). `Trainer` plano (**sin `class_weight`**), early
  stopping (patience 2), mejor checkpoint por **macro-F1**. Hiperparámetros
  del notebook: 4 epochs, batch 16, lr 5e-5 (default de transformers),
  max-length 128, weight_decay 0.0, warmup 10, seed 42. Barrido explorado:
  lr [2e-5, 3e-5, 5e-5] × wd [0.01, 0.1] a 2 épocas (resultados no registrados
  en el notebook guardado). Requiere GPU para tiempo razonable
  (`--subset 500` = smoke test en CPU).
- **Métricas del notebook** (celda 12): val acc 0.7932 / macro-F1 0.7839,
  test acc 0.7755 / macro-F1 0.7468. Peores F1: Correo electrónico 0.51,
  Software y Sistemas 0.55.
- **Baseline previo**: TF-IDF + LogisticRegression, macro-F1 ~0.78 medido
  sobre la taxonomía anterior (19 clases, ver `ml/notebooks/01_eda.ipynb`);
  no comparable directo con el 0.7468 en test (13 clases).
- **Artefactos**: `ml/models/beto-smoke/` (default en local) o
  `ml/models/beto-tickets/` (entrenamiento completo del notebook: config,
  `model.safetensors`, tokenizer, `label_mapping.json`, `metrics.json` con
  hp + clases). Ojo: `beto-smoke` ordena los ids alfabéticamente mientras el
  mapping procesado va por frecuencia — mismo set de 13 clases, distinto
  orden; cada artefacto es autoconsistente (no mezclar ids entre artefactos).

### Servicio (`ml/src/serve.py`)

Micro-API FastAPI (se levanta con `uvicorn serve:app --port 8001`):

| Endpoint | Respuesta |
|---|---|
| `GET /health` | estado + etiquetas disponibles |
| `POST /classify {text}` | `{etiqueta, dominio, subcategoria, confianza, top[3]}` |

Trunca a 2000 caracteres / 256 tokens, mínimo 5 caracteres, inferencia con
`torch.no_grad()` + softmax. La variable `BETO_MODEL_DIR` elige el modelo;
`EXPO_PUBLIC_BETO_URL` lo expone a web/móvil en build.

#### Despliegue prod (imagen + compose)

- **Imagen** `ml/Dockerfile` (python 3.11-slim, torch CPU 2.8.*, deps en
  `ml/requirements-serve.txt`, usuario non-root, HEALTHCHECK a `/health`).
  El modelo NO va en la imagen: se monta read-only (`/model`).
- **Compose**: servicio `beto` (`./ml/models/beto-smoke:/model:ro`, puerto
  8001, healthcheck); `web` lo espera (`depends_on: service_healthy`) y
  hornea `EXPO_PUBLIC_BETO_URL` (default `http://localhost:8001` en local;
  en prod, URL pública del servicio BETO).
- **Verificado en vivo** (2026-10): `/health` → 13 etiquetas;
  `/classify {"text":"No tengo internet…"}` →
  `tic:Conectividad y redes` con confianza 0.9141.

### Integración en pantallas (`shared/src/ia.ts`)

`predecirCategoria(texto, {categorias, mesas})`:

1. **Intenta BETO** (timeout 4s). Si responde, resuelve la etiqueta contra el
   **catálogo vivo de BD por nombre** (dominio + subcategoría normalizados,
   sin tildes) y la mesa por **nombre de mesa** (`resolverMesaId`) — nunca por
   IDs fijos, para sobrevivir a seeds y migraciones. Fuente: `'beto'`.
2. **Fallback a reglas locales** (`classifyLocal`): 13 reglas por keywords con
   puntaje (keyword larga = 2 pts, corta = 1), confianza
   `min(0.55 + score*0.12, 0.92)`. Si ninguna regla matchea, **no se fuerza
   categoría** (retorna `null`). Fuente: `'reglas'`.

La prioridad sale del mapa por subcategoría (`getPrioridadPorSubcategoria`).
Las pantallas (`CreateTicketScreen` web/móvil) disparan con debounce de 800ms,
muestran la fuente ("modelo BETO" vs "reglas locales") y el % de confianza.

La Edge Function `supabase/functions/classify` (RF-22) es un MVP por keywords
con los mismos IDs del seed; el camino principal es `ia.ts` → BETO.

### Loop de validación técnica (cierre RF-22: telemetría modelo-vs-reglas)

La fuente ya se persiste por ticket en `ticket_ia_feedback`
(migración `20261017000000`):

- **Crear:** `CreateTicketScreen` (web/móvil) guarda lo sugerido vía
  `registrarSugerenciaIa` (`shared/src/ia-feedback.ts`); el trigger
  `trg_tickets_crear_ia_feedback` crea la fila `pendiente` al insertar.
- **Validar:** `IaValidationCard` (`shared/src/ui/ticket/IaValidationCard.tsx`)
  en `DetalleTecnicoScreen` (web/móvil). El técnico confirma
  (`confirmarClasificacion`) o reclasifica mesa+categoría obligatorias
  (`corregirClasificacion`). Solo técnico asignado, jefe o admin
  (`puede_validar_ia` + RLS). Sin respuesta queda `pendiente` y NO entrena.
- **Dataset:** vista `dataset_entrenamiento_ia` (solo `confirmada`/`corregida`)
  + `python ml/src/export_dataset_validado.py` → CSV para reentrenamiento.
  `esAptoEntrenamiento` es la guarda en cliente. Tests en
  `shared/src/ia-feedback.test.ts` (21 files / 188 tests en shared).
- **Métricas:** vista `metricas_ia_feedback` (migración `20261019000000`):
  por fuente (`beto`/`reglas`/`manual`) total, pendientes, confirmadas,
  corregidas, `precision_validada` (confirmadas / validadas) y
  `confianza_promedio`. Ambas vistas con `security_invoker = true`: el
  jefe/admin ve el agregado global; el técnico solo el de sus tickets
  (RLS del consultante). Tarjeta `PrecisionIa` en el Dashboard del jefe
  (web/móvil) vía `getMetricasIaFeedback` (`shared/src/dashboard.ts`).

### Reentrenamiento mensual (pipeline `retrain-beto.yml`)

1. **Export:** `export_dataset_validado.py` → `dataset_validado.csv`
   (solo `confirmada`/`corregida`).
2. **Unión:** `build_retrain_dataset.py --clean tickets_clean.parquet
   --validated dataset_validado.csv --out dataset_retrain.parquet`
   (deduplica por texto+categoría, exige texto ≥ 5 chars; columna `fuente`).
3. **Entrenamiento:** `train_beto.py --input dataset_retrain.parquet
   --baseline-metrics ml/baseline_beto.json` — guarda `metrics.json` con
   `promoted` (test macro-F1 ≥ baseline 0.7468 del notebook 02).
4. **Publicación:** `publish_model.py --model-dir ... --version v<fecha>`
   sube al bucket privado `modelos-ia` (migración `20261020000000`, solo
   service_role) ÚNICAMENTE si `promoted=true` (o `--force`).
5. **Despliegue:** descargar la versión del bucket a `/model` del servicio
   `beto` y reiniciar (`serve.py` carga `BET0_MODEL_DIR` al arrancar).

Workflow `.github/workflows/retrain-beto.yml`: mensual (día 1, 05:00 UTC)
+ `workflow_dispatch` con input `force_publish`. Al promover un modelo
mejor, actualizar `ml/baseline_beto.json` con su test macro-F1.

Guía operativa en lenguaje accesible (ciclo, roles, manual vs automático,
cómo ver la mejora): `documentation/reentrenamiento-ia.md`.

---

## 2. Predictor de picos de tickets (ML clásico)

### Qué hace

Pronostica el volumen diario de tickets a 7 días y genera **alertas preventivas**
(`pico_esperado`) + **notificaciones a jefes/admins** cuando ve un pico en 48h.

### Modelo (`ml/src/forecast_picos.py`)

- **Series**: global + top-3 dependencias por volumen
  (Oficina TIC, Comunicaciones, Infraestructura Física).
- **Features**: calendario (dow, mes, finde, inicio de mes) + lags 1/7/14/28 +
  medias rodantes 7/28 + conteo de la misma dow 4 semanas atrás.
- **Candidatos por serie**: `ridge` / `random_forest` / `hist_gb` vs baseline
  `avg28` (la heurística SQL de RF-19). Se queda el de menor MAE en split
  temporal (últimos 30 días como test).
- **Pronóstico**: recursivo a 7 días (el predicho alimenta el siguiente día).
- **Niveles**: umbrales p60 (alta) / p85 (pico) calculados sobre días activos
  (`--umbral-pico-q` permite mover el umbral de pico, default 0.85).
- **Rangos q10–q90** (lote B+C+A): cada día emite `forecast` (puntual) + banda
  `lo`/`hi` calibrada con los residuos del modelo ganador en test (~80%
  cobertura empírica; la métrica `cobertura_q10_q90` queda en `metrics.json`
  por serie). El dashboard muestra el rango en "Peor día (rango)".
- **Frescura** (lote B+C+A): el script escribe `forecast_meta.json`
  (`generado_en` UTC); el upload lo persiste en la columna `generado_en` y la
  UI muestra banner si el pronóstico está próximo a vencer (>5 días) o
  vencido (>8 días, se saltó una corrida). `estadoFrescuraPronostico()` en
  `shared/src/dashboard.ts` (puro y testeado).

Últimas métricas (MAE test, modelo vs baseline):

| Serie | Mejor modelo | MAE | Baseline avg28 |
|---|---|---|---|
| global | random_forest | 10.8 | 25.6 |
| Oficina TIC | ridge | 6.5 | 11.0 |
| Comunicaciones | ridge | 4.7 | 15.9 |
| Infraestructura | random_forest | 1.6 | 2.4 |

Backtest 60 días (1-step): MAE 6.65, precisión de picos 1.00, recall 0.50 —
subestima extremos (los jueves concentran ~50% del volumen, picos 100–161
vs media ~34/día). Margen de mejora conocido: regresión cuantílica o
sobre-muestreo de jueves.

- **Artefactos** (`ml/models/forecast/`, en `.gitignore`): `metrics.json`,
  `forecast_7d.json`, `perfil_horario.json`, `*_model.pkl`.

### Integración (RF-19, migración `20261015000000`)

```
forecast_7d.json ──upload-pronostico──▶ pronosticos_picos ──▶ generar_alertas_pronostico()
      (semanal)      (--sql vía CLI)        (tabla)            (picos próximas 48h)
                                                                    │
                                                        alertas_ia (pico_esperado, alta/crítica)
                                                                    │ trigger trg_alerta_ia_notificar
                                                                    ▼
                                              notificaciones → Realtime + push (send-push)
                                              a jefes/admins activos
```

- **Subida**: `pnpm run upload:pronostico` (dry-run) genera el SQL;
  `pnpm supabase db query --linked --file` lo aplica (conexión directa,
  salta RLS; evita necesitar `service_role`). Upsert idempotente por
  `(fecha, serie, modelo_version)`.
- **Alerta preventiva**: `pico_esperado` (valor añadido al enum `tipo_alerta_ia`;
  ojo: `ALTER TYPE ... ADD VALUE` no corre dentro de transacciones, aplicar
  fuera). Lote B+C+A (recall): la alerta dispara ante **cualquier día con
  `es_pico`** (nivel `alta` o `pico`, no solo `pico`), para atrapar más picos
  a costa de más avisos; severidad `critica` si forecast ≥ 100 o nivel `pico`,
  `alta` si nivel `pico` con forecast < 100, y `media` si el disparo viene de
  nivel `alta`. El mensaje incluye el rango q10–q90. Dedup 24h.
  Se dispara por cron diario 06:00 (requiere extensión `pg_cron`) y por la
  Edge Function `generate-alertas` (solo jefe/admin), que ahora invoca ambas
  generadoras (reactiva + preventiva).
- **Comunicaciones**: el trigger inserta `notificaciones` tipo `alerta_pico`
  a todos los jefes/admins activos → llegan por Realtime al instante y por
  push vía `send-push` (cron 5 min, ya existente). También aplica a
  `pico_inusual` alta/crítica del detector reactivo.
- **Dashboard**: `getPronosticoSemanal()` (`shared/src/dashboard.ts`) lee la
  tabla y devuelve 7 días por serie; retorna `[]` si la migración aún no se aplicó.

### Operación semanal (automatizada)

Workflow `.github/workflows/forecast-semanal.yml` (cron lunes 06:00 UTC,
ejecutable manual con `workflow_dispatch`):

1. `python3 ml/src/export_tickets_live.py` → `data/processed/tickets_live.parquet`
   (tickets vivos vía REST con `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
2. `python3 ml/src/forecast_picos.py --input data/processed/tickets_live.parquet`
3. `pnpm upload:pronostico:push` → upsert en `pronosticos_picos`
4. Invocar `generate-alertas` (o esperar el cron diario 06:00).

Equivalente manual: `pnpm forecast:live` (requiere las env vars y termina
en dry-run de subida; añade `-- --push` vía `upload:pronostico:push` si se
quiere publicar). Las fechas del forecast parten del último día de datos.

### Operación manual (histórico estático)

1. Importar datos nuevos → 2. `python3 ml/src/forecast_picos.py`
3. `pnpm run upload:pronostico -- --push --sql /tmp/p.sql` + apply vía CLI
4. Invocar `generate-alertas` (o esperar el cron). Las fechas del forecast
   parten del último día de datos: con datos desactualizados la ventana de
   48h ya pasó y la generadora retorna 0 correctamente.
