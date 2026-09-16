"""
Exporta los tickets vivos de Supabase al parquet que consume el forecast (RF-19).

Genera las columnas mínimas que usa ml/src/forecast_picos.py:
    fecha_parsed       <- tickets.creado_en
    dependencia_clean  <- mesas.nombre (vía mesa_id; 'Sin mesa' si es nulo)

Las series por dependencia del forecast filtran por los nombres de
TOP_DEPENDENCIAS; los nombres de mesa que no coincidan solo alimentan
la serie global (sin romper el pipeline).

Uso:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python ml/src/export_tickets_live.py
    python ml/src/export_tickets_live.py --output data/processed/tickets_live.parquet
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

PAGE = 1000


def fetch_page(base_url: str, service_key: str, offset: int) -> list:
    params = urllib.parse.urlencode({
        "select": "id,creado_en,mesa_id,mesas(nombre)",
        "order": "creado_en.asc",
        "limit": str(PAGE),
        "offset": str(offset),
    })
    url = f"{base_url.rstrip('/')}/rest/v1/tickets?{params}"
    req = urllib.request.Request(url, headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode("utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser(description="Exporta tickets vivos para el forecast semanal")
    ap.add_argument("--output", default="data/processed/tickets_live.parquet")
    args = ap.parse_args()

    base_url = os.environ.get("SUPABASE_URL", "")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        print("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 2

    rows: list = []
    offset = 0
    while True:
        page = fetch_page(base_url, service_key, offset)
        rows.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE

    print(f"Tickets exportados: {len(rows)}")
    if not rows:
        print("Sin tickets: no se escribe parquet (el forecast necesita histórico)", file=sys.stderr)
        return 1

    df = pd.DataFrame([{
        "fecha_parsed": r.get("creado_en"),
        "dependencia_clean": ((r.get("mesas") or {}).get("nombre")) or "Sin mesa",
    } for r in rows])
    df["fecha_parsed"] = pd.to_datetime(df["fecha_parsed"], utc=True)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, index=False)
    print(f"Parquet escrito en {out} ({len(df)} filas)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
