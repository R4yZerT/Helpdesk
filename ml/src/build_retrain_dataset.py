#!/usr/bin/env python3
"""Construye el dataset de reentrenamiento BETO.

Une dos fuentes y produce el parquet/csv que consume `train_beto.py --input`:
1. Histórico limpio (`tickets_clean.parquet` vía `cleaning.py --push`).
2. Feedback validado por técnicos (`export_dataset_validado.py` → CSV).

Esquema de salida (compatible con `train_beto.py`):
  texto, categoria_label, dominio

Uso:
  python3 build_retrain_dataset.py \
    --clean tickets_clean.parquet \
    --validated dataset_validado.csv \
    --out dataset_retrain.parquet
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd


def main() -> int:
    ap = argparse.ArgumentParser(description="Une histórico + feedback validado para reentrenar BETO")
    ap.add_argument("--clean", required=True, help="Parquet histórico limpio (cleaning.py)")
    ap.add_argument("--validated", required=True, help="CSV feedback validado (export_dataset_validado.py)")
    ap.add_argument("--out", required=True, help="Salida .parquet (o .csv según extensión)")
    args = ap.parse_args()

    clean_path = Path(args.clean)
    val_path = Path(args.validated)
    if not clean_path.exists():
        print(f"[build] no existe histórico: {clean_path}", file=sys.stderr)
        return 1
    if not val_path.exists():
        print(f"[build] no existe validado: {val_path}", file=sys.stderr)
        return 1

    df_clean = pd.read_parquet(clean_path)
    df_val_raw = pd.read_csv(val_path)

    # Puentea el esquema del CSV validado (asunto/descripcion/categoria_nombre
    # "dominio · sub") al esquema del histórico (texto/categoria_label "dominio:sub").
    for col in ("asunto", "descripcion", "categoria_nombre"):
        if col not in df_val_raw.columns:
            print(f"[build] el CSV validado no trae columna '{col}'", file=sys.stderr)
            return 1
    df_val = pd.DataFrame({
        "texto": (df_val_raw["asunto"].fillna("").astype(str) + " "
                  + df_val_raw["descripcion"].fillna("").astype(str)).str.strip(),
        "categoria_label": df_val_raw["categoria_nombre"].astype(str).str.replace(" · ", ":", regex=False),
    })
    df_val["dominio"] = df_val["categoria_label"].str.split(":").str[0]
    df_val = df_val[["texto", "categoria_label", "dominio"]].copy()
    df_val["fuente"] = "validado"

    df_clean = df_clean[["texto", "categoria_label", "dominio"]].copy()
    df_clean["fuente"] = "historico"

    df = pd.concat([df_clean, df_val], ignore_index=True)
    df = df.dropna(subset=["texto", "categoria_label"])
    df = df[df["texto"].astype(str).str.strip().str.len() >= 5]
    df = df.drop_duplicates(subset=["texto", "categoria_label"])

    out = Path(args.out)
    if out.suffix == ".csv":
        df.to_csv(out, index=False)
    else:
        df.to_parquet(out, index=False)

    n_val = int((df["fuente"] == "validado").sum())
    print(f"[build] filas={len(df)} historico={len(df) - n_val} validado={n_val} -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
