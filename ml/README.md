# ML — HelpDesk Tickets

> Fuente de verdad del pipeline BETO: `ml/notebooks/02_train_beto_colab.ipynb`
> (hiperparámetros, consolidación de clases, augmentation y métricas).
> `ml/notebooks/01_eda.ipynb` sigue válido solo como EDA/baseline histórico
> (taxonomía previa de 19 clases, conteos desactualizados).

## Estructura
```
data/raw/tickets_raw.csv              # CSV ; latin1 con BOM mixto (generado desde ACTIVIDADES CONTRATO.pdf)
data/processed/tickets_clean.parquet  # 7928 filas tras limpieza + consolidación a 13 clases (sin comodín)
data/processed/label_mapping.json     # label2id / id2label (orden por frecuencia)
data/quarantine/cuarentena.jsonl      # filas que violan schema (asunto/descripcion corta)
ml/src/cleaning.py                    # pipeline ingesta→tipado→mapeo→cuarentena→anonimización
ml/src/category_mapping.py            # legacy → 19 ticket_categories + consolidación 19→13 + reclasificación del comodín
ml/src/train_beto.py                  # fine-tuning BETO (dccuchile/bert-base-spanish-wwm-cased), réplica local del notebook
ml/src/serve.py                       # micro-API FastAPI de inferencia (puerto 8001)
ml/notebooks/02_train_beto_colab.ipynb # entrenamiento real en Colab (GPU): HP + pesos de referencia
ml/notebooks/01_eda.ipynb             # EDA + baseline TF-IDF/LogReg (histórico, 19 clases)
```

## Clases (13 consolidadas, sin comodín)

El notebook aplica en la celda 6 una consolidación de 8 entradas
(`mapping_consolidation`) y elimina el comodín `general:Sin clasificar / Otros`:

- `tic`: Conectividad y redes, Correo electrónico, Equipos e Infraestructura,
  Gestión de Accesos y Seguridad, Software y Sistemas
- `comunicaciones`: Audiovisual, Eventos y branding, Piezas gráficas y diseño,
  Web y publicaciones
- `infraestructura`: Carpintería y mobiliario, Eléctrica, Hidrosanitaria,
  Obra civil y mantenimiento locativo

Distribución real (parquet, 7928 filas): Piezas gráficas 2087, Accesos 1197,
Equipos 1038, Software 1005, Audiovisual 672, Conectividad 443, Correo 278,
Eventos 265, Web 247, Carpintería 246, Eléctrica 179, Hidrosanitaria 177,
Obra civil 94. Desbalance mayoritaria/menor ≈ 22×.

## Ciclo
1. **Limpieza**: `python ml/src/cleaning.py` (latin1 + fix Ã→utf8, dedup texto,
   consolidación 19→13, comodín reclasificado por léxico o filtrado, cuarentena)
2. **Entrenamiento (Colab GPU)**: `ml/notebooks/02_train_beto_colab.ipynb` —
   split estratificado 80/10/10, augmentation solo en train (sinónimos,
   threshold 80, ×2 por fila → train 6492 / val 793 / test 793),
   `Trainer` plano (**sin `class_weight`**), early stopping (patience 2),
   mejor checkpoint por macro-F1
3. **Réplica local**: `pip install -r ml/requirements.txt && python ml/src/train_beto.py`
   (mismos defaults que el notebook; `--grid` para el barrido lr×wd a 2 épocas;
   `--subset 500` = smoke test en CPU)
4. **Servir**: `uvicorn ml.src.serve:app --port 8001`
   (o `BETO_MODEL_DIR=ml/models/beto-tickets uvicorn ...`)

## Hiperparámetros (del notebook, celda 6)

`model=dccuchile/bert-base-spanish-wwm-cased, epochs=4, batch=16, lr=5e-5
(default de transformers, no se pasa explícito), max_length=128,
weight_decay=0.0, warmup=10, seed=42`.
Grid explorado (celda 8): lr [2e-5, 3e-5, 5e-5] × wd [0.01, 0.1] a 2 épocas
(resultados no registrados en el notebook guardado).

## Métricas de referencia (celda 12)

Val: acc 0.7932, macro-F1 0.7839 · Test: acc 0.7755, macro-F1 0.7468.
Peores F1 por clase: Correo electrónico 0.51, Software y Sistemas 0.55.
Artefactos: `ml/models/beto-tickets/` (config, `model.safetensors` 420M,
tokenizer, `label_mapping.json`, `metrics.json` con hp + clases).

## Notas
- 7928 filas **sí alcanzan** para BETO fine-tuning (no para LLM desde cero).
- `max_length=128` (el notebook no usa 256).
- `ml/models/beto-smoke/` es el default local de `serve.py`; contiene las
  mismas 13 clases pero con **orden de ids alfabético** (el mapping procesado
  va por frecuencia). Cada artefacto es autoconsistente vía su propio
  `label_mapping.json` / `config.id2label`; no mezclar ids entre artefactos.
- El baseline TF-IDF/LogReg macro-F1 ~0.78 se midió sobre la taxonomía previa
  (19 clases), no es comparable directo con el macro-F1 0.7468 en test (13 clases).

## Reproducibilidad
```bash
python ml/src/cleaning.py
# verifica
python -c "import pandas as pd; print(pd.read_parquet('data/processed/tickets_clean.parquet').shape)"
# réplica local del entrenamiento (requiere GPU para tiempo razonable)
python ml/src/train_beto.py --subset 500 --epochs 1 --batch 8
```
