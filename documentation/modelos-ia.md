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
  `general:Sin clasificar / Otros` (se eliminó del dataset con reclasificación
  inteligente por contenido léxico en `ml/src/category_mapping.py`).
- **Datos**: `data/processed/tickets_clean.parquet` (~7926 filas, texto + `label_id`),
  generados por `ml/src/cleaning.py` desde el CSV histórico (RF-26).
  Desbalance fuerte: la clase mayoritaria tiene ~80× filas que la menor (2087/26).
- **Entrenamiento** (`ml/src/train_beto.py`):
  split estratificado 80/10/10, `class_weight` balanceado, early stopping,
  mejor checkpoint por **macro-F1**. Defaults: 3 epochs, batch 16, lr 3e-5,
  max-length 128. Requiere GPU para tiempo razonable (`--subset 500` = smoke test en CPU).
- **Baseline previo**: TF-IDF + LogisticRegression, macro-F1 ~0.78
  (ver `ml/notebooks/01_eda.ipynb`). BETO se adoptó por superar ese piso.
- **Artefactos**: `ml/models/beto-smoke/` (default en local) o
  `ml/models/beto-tickets/` (entrenamiento completo). Incluyen `label_mapping.json`.

### Servicio (`ml/src/serve.py`)

Micro-API FastAPI (se levanta con `uvicorn serve:app --port 8001`):

| Endpoint | Respuesta |
|---|---|
| `GET /health` | estado + etiquetas disponibles |
| `POST /classify {text}` | `{etiqueta, dominio, subcategoria, confianza, top[3]}` |

Trunca a 2000 caracteres / 256 tokens, mínimo 5 caracteres, inferencia con
`torch.no_grad()` + softmax. La variable `BETO_MODEL_DIR` elige el modelo;
`EXPO_PUBLIC_BETO_URL` lo expone a web/móvil en build.

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
- **Niveles**: umbrales p60 (alta) / p85 (pico) calculados sobre días activos.

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
  fuera). Severidad `critica` si forecast ≥ 100, si no `alta`. Dedup 24h.
  Se dispara por cron diario 06:00 (requiere extensión `pg_cron`) y por la
  Edge Function `generate-alertas` (solo jefe/admin), que ahora invoca ambas
  generadoras (reactiva + preventiva).
- **Comunicaciones**: el trigger inserta `notificaciones` tipo `alerta_pico`
  a todos los jefes/admins activos → llegan por Realtime al instante y por
  push vía `send-push` (cron 5 min, ya existente). También aplica a
  `pico_inusual` alta/crítica del detector reactivo.
- **Dashboard**: `getPronosticoSemanal()` (`shared/src/dashboard.ts`) lee la
  tabla y devuelve 7 días por serie; retorna `[]` si la migración aún no se aplicó.

### Operación semanal

1. Importar datos nuevos → 2. `python3 ml/src/forecast_picos.py`
3. `pnpm run upload:pronostico -- --push --sql /tmp/p.sql` + apply vía CLI
4. Invocar `generate-alertas` (o esperar el cron). Las fechas del forecast
   parten del último día de datos: con datos desactualizados la ventana de
   48h ya pasó y la generadora retorna 0 correctamente.
