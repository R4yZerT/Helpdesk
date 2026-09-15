"""Micro-API de inferencia BETO para clasificación de tickets (RF-06/RF-22).

Sirve el modelo fine-tuneado (default: ml/models/beto-smoke/, 13 categorías
consolidadas) vía HTTP para que las apps obtengan dependencia + categoría sin
cargar 110M de parámetros en el cliente.

Uso:
    uvicorn serve:app --host 127.0.0.1 --port 8001
    BETO_MODEL_DIR=/ruta/a/modelo uvicorn serve:app --port 8001

Endpoints:
    GET  /health    -> estado + etiquetas disponibles
    POST /classify  -> {etiqueta, dominio, subcategoria, confianza, top}
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer

log = logging.getLogger("beto-serve")

MODEL_DIR = Path(
    os.environ.get(
        "BETO_MODEL_DIR",
        Path(__file__).resolve().parent.parent / "models" / "beto-smoke",
    )
)
MAX_CHARS = 2000
MAX_TOKENS = 256

state: dict[str, Any] = {}


def split_etiqueta(etiqueta: str) -> tuple[str, str]:
    """'tic:Conectividad y redes' -> ('tic', 'Conectividad y redes')."""
    dom, _, sub = etiqueta.partition(":")
    return dom.strip(), sub.strip()


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    if not MODEL_DIR.is_dir():
        raise RuntimeError(f"BETO_MODEL_DIR no existe: {MODEL_DIR}")
    tok = AutoTokenizer.from_pretrained(str(MODEL_DIR), local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(
        str(MODEL_DIR), local_files_only=True
    )
    model.eval()
    id2label = {int(k): v for k, v in model.config.id2label.items()}
    state.update(tokenizer=tok, model=model, id2label=id2label)
    log.warning("BETO cargado desde %s (%d etiquetas)", MODEL_DIR, len(id2label))
    yield
    state.clear()


app = FastAPI(title="BETO tickets", lifespan=lifespan)


class ClassifyIn(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


@app.get("/health")
def health() -> dict[str, Any]:
    if "model" not in state:
        raise HTTPException(503, "modelo no cargado")
    return {
        "status": "ok",
        "model_dir": str(MODEL_DIR),
        "num_labels": len(state["id2label"]),
        "etiquetas": sorted(state["id2label"].values()),
    }


@app.post("/classify")
def classify(inp: ClassifyIn) -> dict[str, Any]:
    if "model" not in state:
        raise HTTPException(503, "modelo no cargado")
    texto = inp.text.strip()[:MAX_CHARS]
    if len(texto) < 5:
        raise HTTPException(422, "texto muy corto (mínimo 5 caracteres)")
    tok = state["tokenizer"]
    model = state["model"]
    batch = tok(texto, return_tensors="pt", truncation=True, max_length=MAX_TOKENS)
    with torch.no_grad():
        probs = torch.softmax(model(**batch).logits[0], dim=-1)
    k = min(3, probs.numel())
    top = torch.topk(probs, k=k)
    idx = [int(i) for i in top.indices]
    confs = [float(p) for p in top.values]
    etiqueta = state["id2label"][idx[0]]
    dominio, sub = split_etiqueta(etiqueta)
    return {
        "etiqueta": etiqueta,
        "dominio": dominio,
        "subcategoria": sub,
        "confianza": round(confs[0], 4),
        "top": [
            {"etiqueta": state["id2label"][i], "confianza": round(c, 4)}
            for i, c in zip(idx, confs)
        ],
    }
