# BETO inferencia (RF-22) — sirve ml/src/serve.py en :8001 (CPU).
# Build: docker build -f ml/Dockerfile -t helpdesk-beto .
# El modelo NO va en la imagen: se monta como volumen en /model (BETO_MODEL_DIR).
# Ej.: docker run -p 8001:8001 -v ./ml/models/beto-smoke:/model:ro helpdesk-beto
FROM python:3.11-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    BETO_MODEL_DIR=/model

WORKDIR /srv

# torch CPU primero (índice dedicado), resto desde requirements-serve.txt
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch==2.8.*"
COPY ml/requirements-serve.txt ./
RUN pip install --no-cache-dir -r requirements-serve.txt

COPY ml/src/serve.py ./serve.py

# Usuario sin privilegios
RUN useradd --create-home --uid 10001 beto && chown -R beto:beto /srv
USER beto

EXPOSE 8001
HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
