#!/usr/bin/env python3
"""Publica un modelo BETO entrenado al bucket `modelos-ia` de Supabase.

Solo publica si `metrics.json` trae promoted=true (gate de train_beto.py),
salvo --force explícito. Sube por REST con SERVICE_ROLE_KEY:
  modelos-ia/beto-tickets/<version>/{config,pytorch_model,tokenizer,metrics,label_mapping}.json

Uso:
  export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
  python3 publish_model.py --model-dir ml/models/beto-tickets --version v2026-09-17
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

BUCKET = "modelos-ia"
# Archivos que consume serve.py al cargar BET0_MODEL_DIR
ARTEFACTOS = (
    "config.json",
    "model.safetensors",
    "pytorch_model.bin",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.txt",
    "special_tokens_map.json",
    "metrics.json",
    "label_mapping.json",
)


def storage_put(base: str, key: str, dest: str, data: bytes, ctype: str) -> None:
    url = f"{base}/storage/v1/object/{BUCKET}/{dest}"
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}",
                                          "Content-Type": ctype, "x-upsert": "true"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            if r.status not in (200, 201):
                raise RuntimeError(f"PUT {dest} -> HTTP {r.status}")
    except Exception as e:
        print(f"[publish] error subiendo {dest}: {e}", file=sys.stderr)
        raise SystemExit(1)


def main() -> int:
    ap = argparse.ArgumentParser(description="Publica modelo BETO al bucket modelos-ia")
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--version", required=True, help="ej. v2026-09-17 (carpeta destino)")
    ap.add_argument("--force", action="store_true", help="publica aunque promoted=false")
    args = ap.parse_args()

    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        print("[publish] faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    d = Path(args.model_dir)
    metrics_path = d / "metrics.json"
    if not metrics_path.exists():
        print(f"[publish] sin metrics.json en {d}", file=sys.stderr)
        return 1
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    if not metrics.get("promoted", False) and not args.force:
        print("[publish] metrics.promoted=false — el modelo NO supera la baseline. Usa --force para publicar igual.")
        return 2

    subidos = 0
    for name in ARTEFACTOS:
        p = d / name
        if not p.exists():
            continue
        ctype = "application/json" if p.suffix == ".json" else "application/octet-stream"
        storage_put(base, key, f"beto-tickets/{args.version}/{name}", p.read_bytes(), ctype)
        subidos += 1
    print(f"[publish] beto-tickets/{args.version}: {subidos} artefactos (promoted={metrics.get('promoted')})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
