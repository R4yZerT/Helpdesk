# Reentrenamiento de la IA (guía operativa)

> Quién debería leer esto: cualquier persona del equipo que quiera entender
> cómo aprende el clasificador de tickets con el tiempo. Los nombres exactos
> de archivos, tablas y comandos están entre `comillas` para que el ingeniero
> pueda ir directo al código.

## La idea en una frase

Cada vez que un técnico confirma o corrige la categoría sugerida por la IA,
está creando un ejemplo de entrenamiento. Una vez al mes, esos ejemplos se
juntan con el histórico, se entrena un modelo nuevo y **solo reemplaza al
anterior si demuestra ser mejor**. Si no mejora, se descarta solo.

## El ciclo, paso a paso

### 1. El técnico valida (todos los días, en la app)

Al crear un ticket, la IA sugiere dependencia + categoría y eso queda guardado
como `pendiente` en la tabla `ticket_ia_feedback`. El técnico asignado ve la
tarjeta **"✦ Valida la clasificación IA"** en el detalle del ticket:

- **"Sí, está bien"** → el ejemplo queda `confirmada`.
- **"No, reclasificar"** → elige la dependencia y categoría correctas
  (obligatorio) → el ejemplo queda `corregida` con los valores verdaderos.

Regla de oro: **lo que nadie valida no entrena**. Las filas `pendiente` se
ignoran. Si los técnicos no validan, el modelo deja de aprender aunque el
pipeline corra perfecto. La tarjeta `Precisión IA` del dashboard del jefe
muestra cuántas van pendientes: ese número es el termómetro del loop.

Pueden validar el técnico asignado, el jefe o el admin (regla
`puede_validar_ia` + RLS en base de datos).

### 2. Export de ejemplos validados (mensual, automático)

El workflow `retrain-beto.yml` (GitHub Actions) corre el día 1 de cada mes
a las 05:00 UTC, o manualmente desde Actions → *Run workflow*:

1. `export_dataset_validado.py` → descarga solo filas
   `confirmada`/`corregida` a `dataset_validado.csv`.
2. `build_retrain_dataset.py` → une ese CSV con el histórico
   (`tickets_clean.parquet`), elimina duplicados y textos muy cortos
   (< 5 caracteres). Resultado: `dataset_retrain.parquet`.

### 3. Entrenamiento con examen de calidad (automático)

`train_beto.py` entrena el modelo nuevo y lo evalúa con datos que **nunca vio
entrenar** (split temporal train/val/test, early stopping). La nota del examen
es el **macro-F1 en test**: un puntaje 0–1 que mide qué tan bien clasifica en
las 13 categorías, dándole el mismo peso a cada una (así no puede "pasar"
acertando solo la categoría más común).

Luego viene el **gate de promoción**: el puntaje nuevo se compara contra la
referencia guardada en `ml/baseline_beto.json` (hoy `0.7468`):

- `test macro-F1 ≥ baseline` → `promoted=true` (aprobó, se publica).
- Si no → `promoted=false` (reprobó, **se descarta solo**, no toca producción).

En los logs del workflow se ve así:

```
[gate] test macro-F1=0.7612 vs baseline=0.7468 -> PROMOTED
```

`publish_model.py` sube el modelo aprobado al bucket privado `modelos-ia`
(`modelos-ia/beto-tickets/<versión>/`) en Supabase. Con `promoted=false` no
sube nada, salvo que alguien lo fuerce a mano (`--force` / input
`force_publish` del workflow: solo para casos excepcionales, porque salta la
garantía de calidad).

### 4. Puesta en producción (manual, a propósito)

Publicar **no** activa el modelo. El servicio `beto` (`serve.py`) carga el
modelo una vez al arrancar desde `BETO_MODEL_DIR`. Activar una versión:

1. Descargar `modelos-ia/beto-tickets/<versión>/` del bucket a `/model`.
2. Reiniciar el servicio `beto` (compose `depends_on: beto healthy` ya
   encadena la web).
3. Verificar `GET :8001/health` (debe listar las 13 etiquetas).

Es manual para que un humano decida **cuándo** cambiar el modelo que clasifica
en vivo (p. ej. en horario valle), no un cron a las 5am.

### 5. Cierre del loop: actualizar la vara

Cuando un modelo promovido se despliega y rinde bien, hay que subir la vara:
actualizar `ml/baseline_beto.json` con su `test_macro_f1`. Así el próximo
reentrenamiento compite contra el mejor modelo, no contra el 0.7468 original
del notebook 02. Sin este paso, el gate se vuelve fácil de pasar con el tiempo.

## ¿Manual o automático? (resumen)

| Paso | Modo |
|---|---|
| Validar clasificaciones | Manual (técnicos, en la app, día a día) |
| Export + unión + entrenamiento + gate | Automático (mensual) o manual (Actions) |
| Publicación al bucket | Automática **solo si aprueba el gate** |
| Activación en producción | Manual (descargar + reiniciar + healthcheck) |
| Actualizar `baseline_beto.json` | Manual (al desplegar un mejor modelo) |

## Cómo saber si el modelo mejora (3 niveles)

1. **En el run de Actions**: el log del gate (macro-F1 nuevo vs baseline) y
   el `metrics.json` del artefacto (macro-F1 y accuracy en val y test,
   comparables entre meses).
2. **En producción, tarjeta Precisión IA** (dashboard del jefe, web y móvil):
   lee la vista `metricas_ia_feedback` y muestra por fuente (`beto`/`reglas`)
   el % de precisión validada, confirmadas, corregidas, pendientes y confianza
   promedio. Si el modelo mejora de verdad, la precisión de `beto` sube y las
   correcciones bajan con los meses.
3. **Comparando baselines**: el historial de `ml/baseline_beto.json` en git es
   la curva de mejora del proyecto.

## Limitaciones honestas

- Con pocas validaciones al mes, el reentrenamiento aporta poco: el dataset
  validado queda diminuto frente al histórico. El cuello de botella suele ser
  que los técnicos validen, no el pipeline.
- El gate protege contra regresiones, pero el macro-F1 en test no garantiza
  mejora en producción (los datos vivos cambian). La tarjeta Precisión IA es
  el juez final.
- Este pipeline solo reentrena al **clasificador BETO**. El predictor de
  picos (`forecast-semanal.yml`) es un sistema aparte.

Referencia técnica completa: `documentation/modelos-ia.md` (sección
"Reentrenamiento mensual").
