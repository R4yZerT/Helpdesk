"""Forecast de picos de tickets con ML clásico (RF-19).

Agrega el histórico a serie diaria y entrena un regresor por serie
(global + top dependencias) con features de calendario y lags.

Uso:
    python ml/src/forecast_picos.py
    python ml/src/forecast_picos.py --test-dias 30 --forecast-dias 7

Salidas en ml/models/forecast/:
    metrics.json          # MAE/RMSE por modelo y serie (test temporal)
    forecast_7d.json      # pronóstico próximos 7 días con nivel y es_pico
    perfil_horario.json   # promedio por (dow,hour) para el heatmap
    <serie>_model.pkl     # mejor modelo reentrenado con toda la data
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "data" / "processed" / "tickets_clean.parquet"
OUT_DIR = ROOT / "ml" / "models" / "forecast"

# Series a modelar: global + dependencias con más volumen (proxy de mesa)
TOP_DEPENDENCIAS = ["Oficina TIC", "Oficina de Comunicaciones", "Secretaría de Infraestructura Fisica"]
LAGS = (7, 14, 21, 28)


def cargar_serie(df: pd.DataFrame, dependencia: str | None) -> pd.DataFrame:
    """Agrega a conteo diario con índice continuo (días sin tickets = 0)."""
    sub = df if dependencia is None else df[df["dependencia_clean"] == dependencia]
    conteo = sub.groupby(sub["fecha_parsed"].dt.normalize()).size()
    idx = pd.date_range(df["fecha_parsed"].min().normalize(), df["fecha_parsed"].max().normalize(), freq="D")
    serie = conteo.reindex(idx, fill_value=0).rename("y").to_frame()
    serie.index.name = "fecha"
    return serie


def construir_features(serie: pd.DataFrame) -> pd.DataFrame:
    """Features de calendario + lags + rodantes (sin fuga: todo con shift)."""
    d = serie.copy()
    dt = d.index
    d["dow"] = dt.dayofweek
    d["month"] = dt.month
    d["weekofyear"] = dt.isocalendar().week.astype(int)
    d["is_thursday"] = (dt.dayofweek == 3).astype(int)  # jueves concentra ~50% del volumen
    d["is_weekend"] = (dt.dayofweek >= 5).astype(int)
    d["trend"] = np.arange(len(d))
    for lag in LAGS:
        d[f"lag_{lag}"] = d["y"].shift(lag)
    d["same_dow_mean_4"] = np.mean([d["y"].shift(lag) for lag in LAGS], axis=0)
    for w in (7, 14, 28):
        d[f"roll_mean_{w}"] = d["y"].shift(1).rolling(w, min_periods=1).mean()
    d["roll_std_7"] = d["y"].shift(1).rolling(7, min_periods=1).std().fillna(0)
    d["roll_max_7"] = d["y"].shift(1).rolling(7, min_periods=1).max()
    return d.dropna().copy()


def modelos_candidatos() -> dict:
    """Modelos robustos con pocos datos (~200-750 filas por serie)."""
    return {
        "ridge": Ridge(alpha=1.0),
        "random_forest": RandomForestRegressor(n_estimators=300, min_samples_leaf=5, random_state=42, n_jobs=-1),
        "hist_gb": HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_leaf_nodes=15, random_state=42),
    }


def evaluar(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    return {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 2),
    }


def pronostico_recursivo(model, hist: pd.DataFrame, dias: int) -> list[dict]:
    """Pronóstico multi-paso recursivo: cada día predicho alimenta los lags del siguiente."""
    serie = hist[["y"]].copy()
    out: list[dict] = []
    ultima = serie.index.max()
    for i in range(1, dias + 1):
        fecha = ultima + pd.Timedelta(days=i)
        extendida = serie.reindex(pd.date_range(serie.index.min(), fecha, freq="D"), fill_value=np.nan)
        # Rellena el día futuro con la media rodante para poder construir lags
        extendida.loc[fecha, "y"] = extendida["y"].shift(1).rolling(7, min_periods=1).mean().loc[fecha]
        feats = construir_features(extendida).tail(1).drop(columns=["y"])
        pred = max(0.0, float(model.predict(feats)[0]))
        serie.loc[fecha, "y"] = pred
        out.append({"fecha": fecha.strftime("%Y-%m-%d"), "dow": int(fecha.dayofweek), "forecast": round(pred, 1)})
    return out


def marcar_nivel(forecast: list[dict], umbral_alta: float, umbral_pico: float) -> list[dict]:
    for f in forecast:
        v = f["forecast"]
        nivel = "baja" if v < umbral_alta else ("alta" if v < umbral_pico else "pico")
        f["nivel"] = nivel
        f["es_pico"] = nivel in ("alta", "pico")
    return forecast


def entrenar_serie(nombre: str, serie: pd.DataFrame, test_dias: int, forecast_dias: int) -> dict:
    data = construir_features(serie)
    feats = [c for c in data.columns if c != "y"]
    train, test = data.iloc[:-test_dias], data.iloc[-test_dias:]

    # Baseline heurístico actual (SQL RF-19): promedio rodante 28 días
    base_pred = test["roll_mean_28"].to_numpy()
    resultados = {"baseline_avg28": evaluar(test["y"].to_numpy(), base_pred)}

    mejor_nombre, mejor_mae, mejor_model = "baseline_avg28", resultados["baseline_avg28"]["mae"], None
    for nombre_m, model in modelos_candidatos().items():
        model.fit(train[feats], train["y"])
        pred = model.predict(test[feats])
        m = evaluar(test["y"].to_numpy(), pred)
        resultados[nombre_m] = m
        if m["mae"] < mejor_mae:
            mejor_nombre, mejor_mae, mejor_model = nombre_m, m["mae"], model

    # Reentrena el ganador con toda la data y pronostica
    if mejor_model is not None:
        mejor_model.fit(data[feats], data["y"])
        joblib.dump(mejor_model, OUT_DIR / f"{nombre}_model.pkl")
        forecast = pronostico_recursivo(mejor_model, serie, forecast_dias)
    else:
        forecast = [
            {"fecha": (serie.index.max() + pd.Timedelta(days=i)).strftime("%Y-%m-%d"), "forecast": round(float(base_pred.mean()), 1)}
            for i in range(1, forecast_dias + 1)
        ]

    # Umbrales sobre días con actividad (evita que los ceros por finde/gap los hundan)
    activos = serie["y"][serie["y"] > 0]
    base = activos if len(activos) >= 20 else serie["y"]
    umbral_pico = round(float(base.quantile(0.85)), 1)
    umbral_alta = round(float(base.quantile(0.60)), 1)
    forecast = marcar_nivel(forecast, umbral_alta, umbral_pico)
    # Fin de semana con pronóstico bajo nunca es pico (regla operativa)
    for f in forecast:
        if f["dow"] >= 5 and f["forecast"] < umbral_alta:
            f["nivel"] = "baja"
            f["es_pico"] = False
    return {"mejor_modelo": mejor_nombre, "metricas": resultados, "forecast": forecast,
            "umbrales": {"alta": umbral_alta, "pico": umbral_pico}}


def perfil_horario(df: pd.DataFrame) -> list[dict]:
    """Promedio por (dow,hour) para el heatmap del dashboard (lun-vie 7-21)."""
    tmp = df.copy()
    tmp["dow"] = tmp["fecha_parsed"].dt.dayofweek
    tmp["hour"] = tmp["fecha_parsed"].dt.hour
    tmp = tmp[(tmp["dow"] <= 4) & (tmp["hour"].between(7, 21))]
    semanas = max((tmp["fecha_parsed"].max() - tmp["fecha_parsed"].min()).days / 7, 1)
    agg = tmp.groupby(["dow", "hour"]).size().reset_index(name="cnt")
    agg["avg"] = (agg["cnt"] / semanas).round(2)
    return agg[["dow", "hour", "avg"]].to_dict(orient="records")


def main() -> None:
    parser = argparse.ArgumentParser(description="Forecast ML clásico de picos de tickets")
    parser.add_argument("--test-dias", type=int, default=30)
    parser.add_argument("--forecast-dias", type=int, default=7)
    parser.add_argument("--input", type=str, default=str(INPUT),
                        help="Parquet de entrada (por defecto el histórico limpio)")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.read_parquet(args.input)
    df["fecha_parsed"] = pd.to_datetime(df["fecha_parsed"])

    series = {"global": None, **{f"dep_{i}": d for i, d in enumerate(TOP_DEPENDENCIAS)}}
    todo: dict = {}
    for nombre, dep in series.items():
        serie = cargar_serie(df, dep)
        etiqueta = "global" if dep is None else dep
        print(f"\n[{etiqueta}] días={len(serie)} media_dia={serie['y'].mean():.1f} max={serie['y'].max()}")
        res = entrenar_serie(nombre, serie, args.test_dias, args.forecast_dias)
        todo[etiqueta] = res
        print(f"  métricas: {res['metricas']} -> mejor: {res['mejor_modelo']}")

    (OUT_DIR / "metrics.json").write_text(json.dumps(
        {k: {"mejor_modelo": v["mejor_modelo"], "metricas": v["metricas"], "umbrales": v["umbrales"]}
         for k, v in todo.items()}, indent=2, ensure_ascii=False), encoding="utf-8")
    (OUT_DIR / "forecast_7d.json").write_text(json.dumps(
        {k: v["forecast"] for k, v in todo.items()}, indent=2, ensure_ascii=False), encoding="utf-8")
    (OUT_DIR / "perfil_horario.json").write_text(json.dumps(perfil_horario(df), ensure_ascii=False), encoding="utf-8")
    print(f"\n[ok] artefactos en {OUT_DIR}/ (metrics, forecast_7d, perfil_horario, *_model.pkl)")


if __name__ == "__main__":
    main()
