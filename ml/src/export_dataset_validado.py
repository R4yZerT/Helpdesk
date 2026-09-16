"""
Exporta el dataset validado para reentrenamiento (RF IA validación).

Solo incluye tickets con validación técnica (vista dataset_entrenamiento_ia:
estado confirmada/corregida). Sin respuesta del técnico el registro NO aparece
y por tanto NO es apto para entrenamiento.

Uso:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python ml/src/export_dataset_validado.py --output data/processed/dataset_validado.csv
"""
import argparse
import os
import sys
import urllib.request
import urllib.parse
import json
import csv


def fetch_rows(base_url: str, service_key: str) -> list:
    params = urllib.parse.urlencode({
        "select": "ticket_id,asunto,descripcion,mesa_id,categoria_id,mesa_nombre,categoria_nombre,fuente,confianza,estado,fue_corregida,validado_en",
        "order": "validado_en.asc",
        "limit": "10000",
    })
    url = f"{base_url.rstrip('/')}/rest/v1/dataset_entrenamiento_ia?{params}"
    req = urllib.request.Request(url, headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode("utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", default="data/processed/dataset_validado.csv")
    args = ap.parse_args()
    base_url = os.environ.get("SUPABASE_URL", "")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        print("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 2
    rows = fetch_rows(base_url, service_key)
    print(f"Filas validadas: {len(rows)} (solo confirmada/corregida)")
    out = args.output
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    cols = ["ticket_id", "asunto", "descripcion", "mesa_id", "categoria_id",
            "mesa_nombre", "categoria_nombre", "fuente", "confianza",
            "estado", "fue_corregida", "validado_en"]
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"Dataset escrito en {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
