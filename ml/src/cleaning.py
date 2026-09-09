"""
Pipeline de limpieza para tickets_raw.csv -> tickets_clean.parquet
Ciclo: ingesta -> tipado -> limpieza -> mapeo categorías -> cuarentena -> anonimización -> split

Uso:
    python ml/src/cleaning.py
    python ml/src/cleaning.py --input data/raw/tickets_raw.csv --output data/processed/tickets_clean.parquet
"""

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pandas as pd

from category_mapping import resolve_category

# Columnas esperadas en el CSV legacy (BOM incluido en header original)
EXPECTED_COLS = [
    "ID",
    "Consecutivo",
    "Fecha",
    "Hora",
    "Asunto",
    "Descripción",
    "Dirección",
    "Teléfono",
    "Email",
    "Estado",
    "Dependencia",
    "Usuario",
    "Técnico",
    "Tipo de Ticket",
    "Prioridad",
]

ESTADO_MAP = {
    "Abierto": "abierto",
    "En Proceso": "en_proceso",
    "Solucionado": "solucionado",
    "Cerrado": "cerrado",
    "Devuelto": "devuelto",
    "Programado": "programado",
}
PRIORIDAD_MAP = {
    "Baja": "baja",
    "Media": "media",
    "Alta": "alta",
    "Crítica": "critica",
    "Critica": "critica",
}


def normalize_text(s: str) -> str:
    """Limpia artefactos de encoding y espacios."""
    if not isinstance(s, str):
        return ""
    # NFKC normaliza caracteres rotos, strip BOM
    s = s.replace("\ufeff", "").replace("\x00", "")
    s = unicodedata.normalize("NFKC", s)
    # colapsar espacios y saltos
    s = re.sub(r"\s+", " ", s).strip()
    return s


def anonymize_email(email: str) -> str:
    if not email or "@" not in email:
        return ""
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()[:16]


def validate_row(row: pd.Series) -> list[str]:
    """Retorna lista de motivos de cuarentena (vacía = OK)."""
    motivos = []
    asunto = row.get("asunto_clean", "")
    desc = row.get("descripcion_clean", "")
    # según schema: asunto 5-200, descripcion 10-5000
    if len(asunto) < 5:
        motivos.append(f"asunto demasiado corto ({len(asunto)} < 5)")
    if len(asunto) > 200:
        motivos.append(f"asunto demasiado largo ({len(asunto)} > 200)")
    if len(desc) < 10:
        motivos.append(f"descripcion demasiado corta ({len(desc)} < 10)")
    if len(desc) > 5000:
        motivos.append(f"descripcion demasiado larga ({len(desc)} > 5000)")
    # categoría residual ya no debe existir (13 clases finales); si aparece es error ETL
    if row.get("categoria_dominio") == "general" and row.get("categoria_sub") == "Sin clasificar / Otros":
        motivos.append("categoria residual general no permitida (debe ser reclasificada)")
    return motivos


def load_raw(path: Path) -> pd.DataFrame:
    # Archivo mixto utf-8 + cp1252 con BOM y separador ;
    # Usamos csv.DictReader con decodificación robusta (utf-8 errors=replace -> latin1)
    import csv
    # Leer bytes y decodificar: primero intentar utf-8-sig, luego latin1 para filas problemáticas
    # Estrategia: abrir en modo texto con utf-8 y errors='replace' deja � pero recupera columnas
    # Mejora: detectar BOM y limpiar nombres
    rows = []
    fieldnames = None
    # Prueba 1: csv con utf-8 errors replace (recupera 8095 filas como antes)
    # cp1252/latin1 preserva tildes (el archivo es mixto pero body es cp1252, header utf-8 BOM -> ï»¿ se limpia)
    with open(path, encoding="latin1", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        # limpiar BOM del header
        if reader.fieldnames:
            reader.fieldnames = [c.replace("\ufeff", "").replace("ï»¿", "").strip().strip('"').strip("'") for c in reader.fieldnames]
            # también limpiar artefacto latin1 de header (DescripciÃ³n -> Descripción si quedó mal)
            fixed = []
            for c in reader.fieldnames:
                # si contiene Ã, es utf-8 mal decodificado como latin1 -> recodificar
                if "Ã" in c:
                    try:
                        c = c.encode("latin1").decode("utf-8")
                    except Exception:
                        pass
                fixed.append(c)
            reader.fieldnames = fixed
            fieldnames = reader.fieldnames
        for r in reader:
            # limpiar llaves con BOM residual
            clean_r = {}
            for k, v in r.items():
                if k is None:
                    continue
                nk = k.replace("\ufeff", "").replace("ï»¿", "").strip().strip('"').strip("'")
                if "Ã" in nk:
                    try:
                        nk = nk.encode("latin1").decode("utf-8")
                    except Exception:
                        pass
                # valores: reparar mojibake común (Ã³ -> ó)
                if v and "Ã" in v:
                    try:
                        v = v.encode("latin1").decode("utf-8")
                    except Exception:
                        pass
                clean_r[nk] = v if v is not None else ""
            rows.append(clean_r)
    df = pd.DataFrame(rows, dtype=str).fillna("")
    # Asegurar que todas las columnas esperadas existan (crear vacías si faltan)
    for col in EXPECTED_COLS:
        if col not in df.columns:
            # intentar match sin tildes / case-insensitive
            found = None
            for c in df.columns:
                if c.lower().replace("ó","o").replace("í","i").replace("é","e") == col.lower().replace("ó","o").replace("í","i").replace("é","e"):
                    found = c
                    break
            if found:
                df[col] = df[found]
            else:
                df[col] = ""
    print(f"[ingesta] leído filas={len(df)} cols={list(df.columns)[:4]}...")
    return df


def clean_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    # Normalizar todas las celdas de texto
    for col in df.columns:
        df[col] = df[col].apply(normalize_text)

    # Tipado básico
    df["id_legacy"] = df.get("ID", "")
    df["fecha_raw"] = df.get("Fecha", "")
    df["hora_raw"] = df.get("Hora", "")

    # Fecha/hora -> creado_en
    df["fecha_parsed"] = pd.to_datetime(df["fecha_raw"] + " " + df["hora_raw"], errors="coerce", format="%Y-%m-%d %H:%M:%S")
    # fallback sin hora
    mask_bad = df["fecha_parsed"].isna()
    df.loc[mask_bad, "fecha_parsed"] = pd.to_datetime(df.loc[mask_bad, "fecha_raw"], errors="coerce")

    df["asunto_clean"] = df.get("Asunto", "").apply(normalize_text)
    df["descripcion_clean"] = df.get("Descripción", "").apply(normalize_text)

    # Si descripción vacía, rellenar con asunto (no dejar vacío para entrenar)
    mask_empty_desc = df["descripcion_clean"].str.len() < 3
    df.loc[mask_empty_desc, "descripcion_clean"] = df.loc[mask_empty_desc, "asunto_clean"]

    # Texto combinado para BETO
    df["texto"] = (df["asunto_clean"] + " [SEP] " + df["descripcion_clean"]).str.strip()

    # Mapeo categorías legacy -> nuevas (dominio, subcategoria) con consolidación 19→14 y reclasificación inteligente
    # Se pasa texto para eliminar el comodín general:Sin clasificar / Otros
    cats = df.apply(lambda row: resolve_category(row.get("Tipo de Ticket", ""), texto=row.get("texto", "")), axis=1)
    df["categoria_dominio"] = cats.apply(lambda x: x[0])
    df["categoria_sub"] = cats.apply(lambda x: x[1])
    df["categoria_label"] = df["categoria_dominio"] + ":" + df["categoria_sub"]
    # Guardar flag de reclasificación para auditoría (tickets que eran general)
    df["fue_reclasificado"] = df["categoria_label"].notna()  # placeholder, se calcula abajo
    # Detectar si algún ticket aún queda como general (no debería)
    mask_general = (df["categoria_dominio"] == "general") & (df["categoria_sub"] == "Sin clasificar / Otros")
    if mask_general.any():
        print(f"[warn] {mask_general.sum()} tickets aún con categoria general — se reclasificarán a tic:Software y Sistemas")
        df.loc[mask_general, "categoria_dominio"] = "tic"
        df.loc[mask_general, "categoria_sub"] = "Software y Sistemas"
        df.loc[mask_general, "categoria_label"] = "tic:Software y Sistemas"

    # Prioridad y estado normalizados
    df["prioridad_norm"] = df.get("Prioridad", "").apply(lambda x: PRIORIDAD_MAP.get(x.strip(), "media"))
    df["estado_norm"] = df.get("Estado", "").apply(lambda x: ESTADO_MAP.get(x.strip(), "abierto"))

    # PII anonimizada (para train no exponer)
    df["email_hash"] = df.get("Email", "").apply(anonymize_email)
    df["telefono_clean"] = df.get("Teléfono", "")
    # marcar teléfonos personales vs extensiones
    df["tiene_pii"] = df["email_hash"].ne("") | df["telefono_clean"].ne("")

    # Dependencia limpia
    df["dependencia_clean"] = df.get("Dependencia", "")
    df["usuario_clean"] = df.get("Usuario", "")
    df["tecnico_clean"] = df.get("Técnico", "").replace({"N/A": ""}, regex=False)

    # Detectar filas duplicadas exactas por texto (no por ID)
    df["texto_hash"] = df["texto"].apply(lambda x: hashlib.md5(x.encode()).hexdigest())
    dup_mask = df.duplicated(subset=["texto_hash"], keep="first")
    df["es_duplicado_texto"] = dup_mask

    # Validación y cuarentena
    motivos_list = df.apply(validate_row, axis=1)
    df["motivos_cuarentena"] = motivos_list.apply(lambda x: "; ".join(x) if x else "")
    df["en_cuarentena"] = df["motivos_cuarentena"].ne("")

    # Separar clean vs cuarentena
    df_clean = df[~df["en_cuarentena"]].copy()
    df_quar = df[df["en_cuarentena"]].copy()

    # Eliminar duplicados de texto en clean (mantener 1)
    df_clean = df_clean.drop_duplicates(subset=["texto_hash"], keep="first")

    # Validación MLOps: no debe quedar categoría residual
    assert "general:Sin clasificar / Otros" not in df_clean["categoria_label"].unique(), "ETL error: aún existe categoria comodín"
    # Validación esperado 13 clases (14 consolidadas -1 residual)
    n_clases = df_clean["categoria_label"].nunique()
    if n_clases != 13:
        print(f"[warn] clases esperadas=13, encontradas={n_clases}: {sorted(df_clean['categoria_label'].unique())}")

    # Label id para BETO (orden estable por frecuencia)
    label_order = df_clean["categoria_label"].value_counts().index.tolist()
    label2id = {lbl: i for i, lbl in enumerate(label_order)}
    id2label = {i: lbl for lbl, i in label2id.items()}
    df_clean["label_id"] = df_clean["categoria_label"].map(label2id)

    # Guardar mapping para el trainer
    df_clean.attrs["label2id"] = label2id
    df_clean.attrs["id2label"] = id2label

    return df_clean, df_quar


def main():
    parser = argparse.ArgumentParser(description="Limpieza de tickets raw -> processed")
    parser.add_argument("--input", type=str, default="data/raw/tickets_raw.csv")
    parser.add_argument("--output", type=str, default="data/processed/tickets_clean.parquet")
    parser.add_argument("--quarantine", type=str, default="data/quarantine/cuarentena.jsonl")
    parser.add_argument("--csv-out", type=str, default="data/processed/tickets_clean.csv")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    inp = (root / args.input) if not Path(args.input).is_absolute() else Path(args.input)
    out_parquet = (root / args.output) if not Path(args.output).is_absolute() else Path(args.output)
    out_csv = (root / args.csv_out) if not Path(args.csv_out).is_absolute() else Path(args.csv_out)
    out_quar = (root / args.quarantine) if not Path(args.quarantine).is_absolute() else Path(args.quarantine)

    if not inp.exists():
        raise FileNotFoundError(f"No existe input: {inp}")

    df_raw = load_raw(inp)
    print(f"[raw] shape={df_raw.shape} cols={list(df_raw.columns)[:5]}...")

    df_clean, df_quar = clean_dataframe(df_raw)

    out_parquet.parent.mkdir(parents=True, exist_ok=True)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    out_quar.parent.mkdir(parents=True, exist_ok=True)

    # Guardar clean: columnas mínimas para entrenamiento + auditoría
    cols_export = [
        "id_legacy",
        "texto",
        "asunto_clean",
        "descripcion_clean",
        "categoria_label",
        "categoria_dominio",
        "categoria_sub",
        "label_id",
        "prioridad_norm",
        "estado_norm",
        "dependencia_clean",
        "fecha_parsed",
        "email_hash",
        "es_duplicado_texto",
    ]
    # solo las que existan
    cols_export = [c for c in cols_export if c in df_clean.columns]
    df_export = df_clean[cols_export].copy()

    # Parquet (óptimo) y CSV (portable)
    try:
        df_export.to_parquet(out_parquet, index=False)
        print(f"[clean] parquet -> {out_parquet} filas={len(df_export)}")
    except Exception as e:
        print(f"[clean] parquet fallo ({e}), solo CSV")

    df_export.to_csv(out_csv, index=False, encoding="utf-8")
    print(f"[clean] csv -> {out_csv} filas={len(df_export)}")

    # Label mapping
    label2id = df_clean.attrs.get("label2id", {})
    mapping_path = out_parquet.parent / "label_mapping.json"
    with open(mapping_path, "w", encoding="utf-8") as f:
        json.dump({"label2id": label2id, "id2label": {str(k): v for k, v in df_clean.attrs.get("id2label", {}).items()}}, f, ensure_ascii=False, indent=2)
    print(f"[clean] mapping -> {mapping_path} clases={len(label2id)}")

    # Cuarentena
    if len(df_quar) > 0:
        # guardar como JSONL con fila_original + motivo
        with open(out_quar, "w", encoding="utf-8") as f:
            for _, row in df_quar.iterrows():
                rec = {
                    "id_legacy": row.get("id_legacy", ""),
                    "motivo": row.get("motivos_cuarentena", ""),
                    "asunto": row.get("asunto_clean", "")[:200],
                    "descripcion": row.get("descripcion_clean", "")[:500],
                    "tipo_ticket_raw": row.get("Tipo de Ticket", ""),
                    "categoria_label": row.get("categoria_label", ""),
                }
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(f"[cuarentena] {len(df_quar)} filas -> {out_quar} ({len(df_quar)/len(df_raw)*100:.1f}%)")
    else:
        print("[cuarentena] 0 filas")

    # Resumen
    print("\n=== Resumen ===")
    print(f"Raw: {len(df_raw)} | Clean: {len(df_export)} | Cuarentena: {len(df_quar)} | Dups texto eliminados: {df_raw['texto_hash'].duplicated().sum() if 'texto_hash' in df_raw.columns else 'n/a'}")
    print("Distribución categorías (clean):")
    print(df_export["categoria_label"].value_counts().to_string())
    print("\nPrioridad:")
    print(df_export["prioridad_norm"].value_counts().to_string())


if __name__ == "__main__":
    main()
