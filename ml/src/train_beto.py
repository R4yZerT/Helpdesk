"""
Fine-tuning BETO para clasificación de tickets HelpDesk (13 clases consolidadas).

Réplica local de `ml/notebooks/02_train_beto_colab.ipynb` (fuente de verdad
de hiperparámetros y pipeline). El notebook corre en Colab con GPU; este
script permite repetir el mismo entrenamiento en máquina local.

Dataset: data/processed/tickets_clean.parquet (7928 filas, texto + label_id,
13 clases sin comodín `general:Sin clasificar / Otros`)
Modelo: dccuchile/bert-base-spanish-wwm-cased (110M params)
Ciclo: consolidación 8 entradas + filtro comodín → split estratificado
80/10/10 → augmentation SOLO en train → Trainer plano (sin class_weight) +
early stopping (patience 2), mejor checkpoint por macro-F1.

HP del notebook: epochs=4, batch=16, lr=5e-5 (default de transformers; el
notebook no lo pasa explícito), max_length=128, weight_decay=0.0,
warmup=10, seed=42. Barrido explorado en el notebook: lr [2e-5, 3e-5, 5e-5]
x wd [0.01, 0.1] a 2 épocas (--grid lo repite en local).

Métricas de referencia del notebook: val acc 0.7932 / macro-F1 0.7839,
test acc 0.7755 / macro-F1 0.7468.

Uso:
    pip install -r ml/requirements.txt
    python ml/src/train_beto.py
    python ml/src/train_beto.py --grid
    python ml/src/train_beto.py --subset 500 --epochs 1 --batch 8   # smoke test CPU

Requiere GPU para tiempo razonable; en CPU funciona con --subset para smoke test.
"""

import argparse
import json
import random
from pathlib import Path

import numpy as np
import pandas as pd

# Consolidación 19 -> 13 (idéntica a la celda 6 del notebook).
MAPPING_CONSOLIDATION: dict[str, str] = {
    "tic:Gestión de usuarios": "tic:Gestión de Accesos y Seguridad",
    "tic:Permisos y accesos": "tic:Gestión de Accesos y Seguridad",
    "tic:Contraseñas y seguridad": "tic:Gestión de Accesos y Seguridad",
    "tic:Software y aplicaciones": "tic:Software y Sistemas",
    "tic:Soporte y aplicaciones institucionales": "tic:Software y Sistemas",
    "tic:Datos y respaldos": "tic:Equipos e Infraestructura",
    "tic:Impresoras y escáneres": "tic:Equipos e Infraestructura",
    "tic:Equipos y hardware": "tic:Equipos e Infraestructura",
}
COMODIN = "general:Sin clasificar / Otros"

# Sinónimos de augmentation (idénticos a la celda 11 del notebook).
SYNONYMS: dict[str, list[str]] = {
    "usuario": ["cuenta", "colaborador"],
    "falla": ["error", "problema"],
    "acceso": ["entrada", "ingreso"],
    "equipo": ["pc", "computador"],
}
# Clases con menos de este n° de filas en train se duplican x2 con augmentation.
MINORITY_THRESHOLD = 80


def load_data(root: Path):
    parquet = root / "data" / "processed" / "tickets_clean.parquet"
    csv = root / "data" / "processed" / "tickets_clean.csv"
    if parquet.exists():
        df = pd.read_parquet(parquet)
    else:
        df = pd.read_csv(csv)
    return df


def consolidar(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica consolidación 19->13 + filtro comodín (celda 6 del notebook).

    Si el parquet ya viene consolidado (caso normal), no cambia nada.
    """
    df = df.copy()
    if "categoria_label" not in df.columns:
        return df
    if "label" in df.columns:
        df = df.rename(columns={"label": "categoria_label"})
    df["categoria_label"] = df["categoria_label"].replace(MAPPING_CONSOLIDATION)
    n_antes = len(df)
    if COMODIN in df["categoria_label"].values:
        n_comodin = int((df["categoria_label"] == COMODIN).sum())
        df = df[df["categoria_label"] != COMODIN].copy()
        print(f"[consolidar] comodín eliminado: {n_comodin} filas ({n_antes} -> {len(df)})")
    # ids alfabéticos como en el notebook (sorted), no por frecuencia
    unique_labels = sorted(df["categoria_label"].unique())
    label2id = {lbl: i for i, lbl in enumerate(unique_labels)}
    id2label = {i: lbl for lbl, i in label2id.items()}
    df["label_id"] = df["categoria_label"].map(label2id)
    print(f"[consolidar] dataset: {len(df)} filas, {len(unique_labels)} clases")
    return df, label2id, id2label


def augment_technical_text(text: str, rng: random.Random) -> str:
    words = text.split()
    for i, word in enumerate(words):
        w = word.lower().strip(",.")
        if w in SYNONYMS and rng.random() > 0.4:
            words[i] = rng.choice(SYNONYMS[w])
    return " ".join(words)


def augment_train(df_train: pd.DataFrame, seed: int) -> pd.DataFrame:
    """Duplica x2 las filas de clases minoritarias (<80) solo en train (celda 11)."""
    rng = random.Random(seed)
    counts = df_train["label_id"].value_counts()
    minority = counts[counts < MINORITY_THRESHOLD].index
    extra = []
    for lid in minority:
        class_df = df_train[df_train["label_id"] == lid]
        for _ in range(2):
            for _, row in class_df.iterrows():
                nr = row.copy()
                nr["texto"] = augment_technical_text(row["texto"], rng)
                extra.append(nr)
    if extra:
        df_train = pd.concat([df_train, pd.DataFrame(extra)], ignore_index=True)
        print(f"[augment] +{len(extra)} filas sintéticas en train")
    return df_train


def hp_dict(args) -> dict:
    return {
        "model": args.model,
        "epochs": args.epochs,
        "batch": args.batch,
        "lr": args.lr,
        "max_length": args.max_length,
        "weight_decay": args.weight_decay,
        "warmup": args.warmup,
        "seed": args.seed,
    }


def main():
    parser = argparse.ArgumentParser(description="Fine-tune BETO para tickets (réplica del notebook 02)")
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--eval-batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=5e-5,
                        help="el notebook usa el default de transformers (5e-5)")
    parser.add_argument("--weight-decay", type=float, default=0.0)
    parser.add_argument("--warmup", type=int, default=10)
    parser.add_argument("--max-length", type=int, default=128)
    parser.add_argument("--model", type=str, default="dccuchile/bert-base-spanish-wwm-cased")
    parser.add_argument("--output", type=str, default="ml/models/beto-tickets")
    parser.add_argument("--subset", type=int, default=0, help="si >0, entrena solo con N filas (smoke test CPU)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--grid", action="store_true",
                        help="barrido lr x wd a 2 épocas (como celda 8) y entrena final con el mejor")
    parser.add_argument("--grid-lrs", type=str, default="2e-5,3e-5,5e-5")
    parser.add_argument("--grid-wds", type=str, default="0.01,0.1")
    parser.add_argument("--grid-epochs", type=int, default=2)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    df = load_data(root)
    print(f"[data] filas={len(df)}")

    if "categoria_label" in df.columns:
        df, label2id, id2label = consolidar(df)
    else:
        mapping = root / "data" / "processed" / "label_mapping.json"
        with open(mapping, encoding="utf-8") as f:
            mp = json.load(f)
        id2label = {int(k): v for k, v in mp["id2label"].items()}
        label2id = {v: k for k, v in id2label.items()}

    if args.subset and args.subset < len(df):
        df = df.sample(n=args.subset, random_state=args.seed).reset_index(drop=True)
        print(f"[subset] reducido a {len(df)}")

    # split estratificado 80/10/10 (primero, para evitar leakage)
    from sklearn.model_selection import train_test_split

    tr_idx, tmp_idx = train_test_split(df.index, test_size=0.20, random_state=args.seed, stratify=df["label_id"])
    val_idx, te_idx = train_test_split(tmp_idx, test_size=0.50, random_state=args.seed, stratify=df.loc[tmp_idx, "label_id"])

    df_train = augment_train(df.loc[tr_idx].copy(), args.seed)
    df_val = df.loc[val_idx].reset_index(drop=True)
    df_test = df.loc[te_idx].reset_index(drop=True)
    print(f"[split] train {len(df_train)} (aumentado) val {len(df_val)} test {len(df_test)}")

    # imports pesados (transformers, torch) solo aquí para que --help no falle sin deps
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer, EarlyStoppingCallback
        from sklearn.metrics import f1_score, accuracy_score, classification_report
    except ImportError as e:
        print(f"[error] falta dependencia: {e}")
        print("Instala con: pip install -r ml/requirements.txt  (transformers torch scikit-learn datasets accelerate)")
        raise SystemExit(1)

    tokenizer = AutoTokenizer.from_pretrained(args.model)

    class TicketDataset(torch.utils.data.Dataset):
        def __init__(self, df_):
            self.enc = tokenizer(df_["texto"].tolist(), truncation=True, padding="max_length", max_length=args.max_length)
            self.labels = df_["label_id"].astype(int).tolist()
        def __len__(self): return len(self.labels)
        def __getitem__(self, i):
            item = {k: torch.tensor(v[i]) for k, v in self.enc.items()}
            item["labels"] = torch.tensor(self.labels[i], dtype=torch.long)
            return item

    train_ds = TicketDataset(df_train)
    val_ds = TicketDataset(df_val)
    test_ds = TicketDataset(df_test)

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=1)
        return {
            "accuracy": accuracy_score(labels, preds),
            "macro_f1": f1_score(labels, preds, average="macro", zero_division=0),
            "weighted_f1": f1_score(labels, preds, average="weighted", zero_division=0),
        }

    def make_model():
        return AutoModelForSequenceClassification.from_pretrained(
            args.model, num_labels=len(id2label), id2label=id2label, label2id=label2id,
        )

    def make_args(lr: float, wd: float, epochs: int, out_subdir: str = ""):
        out_dir = (root / args.output) if not Path(args.output).is_absolute() else Path(args.output)
        if out_subdir:
            out_dir = out_dir / out_subdir
        out_dir.mkdir(parents=True, exist_ok=True)
        return TrainingArguments(
            output_dir=str(out_dir),
            num_train_epochs=epochs,
            per_device_train_batch_size=args.batch,
            per_device_eval_batch_size=args.eval_batch,
            learning_rate=lr,
            weight_decay=wd,
            warmup_steps=args.warmup,
            logging_steps=50,
            eval_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="macro_f1",
            greater_is_better=True,
            seed=args.seed,
            report_to="none",
            save_total_limit=2,
        )

    lr, wd = args.lr, args.weight_decay
    if args.grid:
        print("[grid] barrido lr x wd a {} épocas".format(args.grid_epochs))
        best_f1, best = -1.0, (lr, wd)
        for glr in [float(x) for x in args.grid_lrs.split(",")]:
            for gwd in [float(x) for x in args.grid_wds.split(",")]:
                print(f">>> lr={glr} | weight_decay={gwd} <<<")
                g_trainer = Trainer(
                    model=make_model(),
                    args=make_args(glr, gwd, args.grid_epochs, f"temp_lr_{glr}_wd_{gwd}"),
                    train_dataset=train_ds,
                    eval_dataset=val_ds,
                    compute_metrics=compute_metrics,
                    callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
                )
                g_trainer.train()
                res = g_trainer.evaluate(val_ds)
                print(f"Resultado -> Val Macro-F1: {res['eval_macro_f1']:.4f} | Val Accuracy: {res['eval_accuracy']:.4f}")
                if res["eval_macro_f1"] > best_f1:
                    best_f1, best = res["eval_macro_f1"], (glr, gwd)
                    print("[grid] nuevo mejor")
        lr, wd = best
        print(f"[grid] mejor: lr={lr} wd={wd} (macro-F1 {best_f1:.4f})")

    trainer = Trainer(
        model=make_model(),
        args=make_args(lr, wd, args.epochs),
        train_dataset=train_ds,
        eval_dataset=val_ds,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    print("[train] inicio")
    trainer.train()
    print("[train] fin, evaluando val y test")

    val_metrics = trainer.evaluate(val_ds)
    print(f"[val] {val_metrics}")
    test_metrics = trainer.evaluate(test_ds)
    print(f"[test] {test_metrics}")

    # reporte por clase en test
    preds = trainer.predict(test_ds)
    y_pred = np.argmax(preds.predictions, axis=1)
    y_true = preds.label_ids
    labels_present = sorted(set(int(x) for x in y_true) | set(int(x) for x in y_pred))
    target_names_present = [id2label[i] for i in labels_present]
    print(classification_report(y_true, y_pred, labels=labels_present, target_names=target_names_present, zero_division=0))

    # guardar modelo + tokenizer + métricas (mismo formato que la celda 12)
    out_dir = (root / args.output) if not Path(args.output).is_absolute() else Path(args.output)
    trainer.save_model(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    hp = hp_dict(args)
    hp.update({"lr_final": lr, "weight_decay_final": wd, "grid": args.grid})
    with open(out_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump({"val": val_metrics, "test": test_metrics, "hp": hp, "clases": len(id2label)},
                  f, ensure_ascii=False, indent=2)
    with open(out_dir / "label_mapping.json", "w", encoding="utf-8") as f:
        json.dump({"label2id": label2id, "id2label": {str(k): v for k, v in id2label.items()}},
                  f, ensure_ascii=False, indent=2)
    print(f"[save] modelo -> {out_dir}")
    print(f"[save] métricas -> {out_dir / 'metrics.json'}")


if __name__ == "__main__":
    main()
