# ML — HelpDesk Tickets

## Estructura
```
data/raw/tickets_raw.csv          # 8095 filas, CSV ; latin1 con BOM mixto (generado desde ACTIVIDADES CONTRATO.pdf)
data/processed/tickets_clean.parquet  # 7926 filas tras limpieza + mapeo 139 → 19 categorías
data/processed/label_mapping.json      # label2id / id2label (orden por frecuencia)
data/quarantine/cuarentena.jsonl        # 127 filas que violan schema (asunto/descripcion corta)
ml/src/cleaning.py                # pipeline ingesta→tipado→mapeo→cuarentena→anonimización
ml/src/category_mapping.py        # 139 legacy → 19 ticket_categories (robusto a mojibake)
ml/src/train_beto.py              # fine-tuning BETO (dccuchile/bert-base-spanish-wwm-cased)
ml/notebooks/01_eda.ipynb          # EDA + baseline TF-IDF/LogReg + recomendaciones
```

## Ciclo
1. **Limpieza**: `python ml/src/cleaning.py` (latin1 + fix Ã→utf8, dedup texto, cuarentena 1.6%)
2. **EDA**: `jupyter lab ml/notebooks/01_eda.ipynb` — desbalance 2087/26 (80×), p95 texto 256 tokens, baseline LogReg macro-F1 ~0.78
3. **Entrenamiento**: `pip install -r ml/requirements.txt && python ml/src/train_beto.py` (5 épocas, lr 2e-5, batch 16, max_length 256, class_weight, early stopping)
4. **Smoke test CPU**: `python ml/src/train_beto.py --subset 500 --epochs 1 --batch 8`

## Notas
- 8095 filas **sí alcanzan** para BETO fine-tuning (no para LLM desde cero). Promedio 417/clase.
- Clases raras: `tic:Datos y respaldos` (26) y `infraestructura:Obra civil` (62) — usan `class_weight`.
- `max_length=256` cubre p99 (99% textos <120 palabras).
- Modelo exportado a `ml/models/beto-tickets/` para inferencia en Supabase Edge Function.

## Forecast de picos (ML clásico)
- Script: `ml/src/forecast_picos.py` — serie diaria global + top 3 dependencias, features calendario + lags + rodantes.
- Modelos: `ridge` / `random_forest` / `hist_gb` vs baseline `avg28` (heurística SQL RF-19). Split temporal últimos 30 días.
- Resultado actual: global `random_forest` MAE 10.8 vs baseline 25.6; umbrales sobre días activos (alta p60, pico p85).
- Uso: `python ml/src/forecast_picos.py --test-dias 30 --forecast-dias 7` → artefactos en `ml/models/forecast/` (gitignored: `metrics.json`, `forecast_7d.json`, `perfil_horario.json`, `*_model.pkl`).
- Integración pendiente: batch que suba `forecast_7d.json` a tabla `pronosticos_picos` para el dashboard.

## Reproducibilidad
```bash
python ml/src/cleaning.py
# verifica
python -c "import pandas as pd; print(pd.read_parquet('data/processed/tickets_clean.parquet').shape)"
# baseline rápido sin GPU
python -c "import sklearn; print(sklearn.__version__)"
```
