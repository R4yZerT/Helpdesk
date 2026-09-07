"""
Fine-tuning BETO para clasificación de tickets HelpDesk (19 clases).

Dataset: data/processed/tickets_clean.parquet (7926 filas, texto + label_id)
Modelo: dccuchile/bert-base-spanish-wwm-cased (110M params)
Ciclo: train 80 / val 10 / test 10 estratificado, class_weight, early stopping, macro-F1

Uso:
    pip install -r ml/requirements.txt
    python ml/src/train_beto.py
    python ml/src/train_beto.py --epochs 5 --batch 16 --max-length 256 --output ml/models/beto-tickets

Requiere GPU para tiempo razonable; en CPU funciona con --subset 500 para smoke test.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


def load_data(root: Path):
    parquet = root / "data" / "processed" / "tickets_clean.parquet"
    csv = root / "data" / "processed" / "tickets_clean.csv"
    mapping = root / "data" / "processed" / "label_mapping.json"
    if parquet.exists():
        df = pd.read_parquet(parquet)
    else:
        df = pd.read_csv(csv)
    with open(mapping, encoding="utf-8") as f:
        mp = json.load(f)
    # mp tiene label2id y id2label (id2label keys como str)
    id2label = {int(k): v for k, v in mp["id2label"].items()}
    label2id = {v: int(k) for k, v in mp["id2label"].items()}  # invertir id2label es más confiable
    # fallback si label2id falta
    if not label2id:
        label2id = {k: int(v) for k, v in mp["label2id"].items()}
        id2label = {int(v): k for k, v in label2id.items()}
    return df, label2id, id2label


def main():
    parser = argparse.ArgumentParser(description="Fine-tune BETO para tickets")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--eval-batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--model", type=str, default="dccuchile/bert-base-spanish-wwm-cased")
    parser.add_argument("--output", type=str, default="ml/models/beto-tickets")
    parser.add_argument("--subset", type=int, default=0, help="si >0, entrena solo con N filas (smoke test CPU)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    df, label2id, id2label = load_data(root)
    print(f"[data] filas={len(df)} clases={len(label2id)}")
    print(f"[labels] {list(label2id.items())[:3]} ...")

    if args.subset and args.subset < len(df):
        df = df.sample(n=args.subset, random_state=args.seed).reset_index(drop=True)
        print(f"[subset] reducido a {len(df)}")

    # split estratificado 80/10/10
    from sklearn.model_selection import train_test_split

    idx = np.arange(len(df))
    tr_idx, tmp_idx = train_test_split(idx, test_size=0.20, random_state=args.seed, stratify=df["label_id"])
    val_idx, te_idx = train_test_split(tmp_idx, test_size=0.50, random_state=args.seed, stratify=df.iloc[tmp_idx]["label_id"])
    print(f"[split] train {len(tr_idx)} val {len(val_idx)} test {len(te_idx)}")

    df_train = df.iloc[tr_idx].reset_index(drop=True)
    df_val = df.iloc[val_idx].reset_index(drop=True)
    df_test = df.iloc[te_idx].reset_index(drop=True)

    # imports pesados (transformers, torch) solo aquí para que --help no falle sin deps
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer, EarlyStoppingCallback
        from sklearn.metrics import f1_score, accuracy_score, classification_report
        from sklearn.utils.class_weight import compute_class_weight
    except ImportError as e:
        print(f"[error] falta dependencia: {e}")
        print("Instala con: pip install -r ml/requirements.txt  (transformers torch scikit-learn datasets accelerate)")
        raise SystemExit(1)

    tokenizer = AutoTokenizer.from_pretrained(args.model)

    def tokenize(batch):
        return tokenizer(batch["texto"], truncation=True, padding="max_length", max_length=args.max_length)

    # clase Dataset
    class TicketDataset(torch.utils.data.Dataset):
        def __init__(self, df_):
            self.texts = df_["texto"].tolist()
            self.labels = df_["label_id"].astype(int).tolist()
            self.enc = tokenizer(self.texts, truncation=True, padding="max_length", max_length=args.max_length)
        def __len__(self): return len(self.labels)
        def __getitem__(self, i):
            item = {k: torch.tensor(v[i]) for k, v in self.enc.items()}
            item["labels"] = torch.tensor(self.labels[i], dtype=torch.long)
            return item

    train_ds = TicketDataset(df_train)
    val_ds = TicketDataset(df_val)
    test_ds = TicketDataset(df_test)

    # class weights para loss (clases raras como Datos y respaldos n=26)
    classes = np.array(sorted(label2id.values())) if label2id else np.arange(len(id2label))
    # compute_class_weight necesita y
    y_train = df_train["label_id"].astype(int).values
    # mapear a índices 0..n-1 contiguos (ya lo son si label_id es 0..18)
    # si los ids no son contiguos, re-mapear
    unique_labels = np.unique(y_train)
    weights = compute_class_weight(class_weight="balanced", classes=np.unique(df["label_id"].values), y=y_train)
    # ordenar por label id
    label_ids_sorted = sorted(np.unique(df["label_id"].values))
    weight_map = {lid: w for lid, w in zip(label_ids_sorted, weights)}
    # no usamos directamente en Trainer; sobreescribimos loss vía subclass si quieres, pero Trainer lo ignora
    # alternativa simple: pasar class_weight al modelo vía custom Trainer
    print(f"[weights] ejemplo {list(weight_map.items())[:3]}  max {max(weights):.2f}")

    model = AutoModelForSequenceClassification.from_pretrained(
        args.model,
        num_labels=len(label2id),
        id2label=id2label,
        label2id=label2id,
    )

    # métricas
    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=1)
        return {
            "accuracy": accuracy_score(labels, preds),
            "macro_f1": f1_score(labels, preds, average="macro", zero_division=0),
            "weighted_f1": f1_score(labels, preds, average="weighted", zero_division=0),
        }

    out_dir = (root / args.output) if not Path(args.output).is_absolute() else Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    # TrainingArguments compatible con transformers 4.x/5.x
    training_args = TrainingArguments(
        output_dir=str(out_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.eval_batch,
        learning_rate=args.lr,
        weight_decay=0.01,
        warmup_ratio=0.10,
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

    # Trainer con class-weighted loss (opcional)
    class WeightedTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
            labels = inputs.get("labels")
            outputs = model(**inputs)
            logits = outputs.get("logits")
            import torch.nn.functional as F
            # pesos alineados a label ids 0..n-1
            # construir tensor de pesos en orden de label_ids_sorted
            device = logits.device
            w = torch.tensor([weight_map.get(lid, 1.0) for lid in sorted(label2id.values())], dtype=torch.float, device=device)
            # si label2id valores no son 0..n-1 contiguos, mapear
            # en nuestro caso lo son (0..18) por construcción
            loss = F.cross_entropy(logits, labels, weight=w)
            return (loss, outputs) if return_outputs else loss

    trainer = WeightedTrainer(
        model=model,
        args=training_args,
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
    target_names = [id2label[i] for i in sorted(id2label)]
    print(classification_report(y_true, y_pred, target_names=target_names, zero_division=0))

    # guardar modelo + tokenizer + métricas
    trainer.save_model(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    with open(out_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump({"val": val_metrics, "test": test_metrics, "args": vars(args)}, f, ensure_ascii=False, indent=2)
    # copiar mapping para inferencia
    with open(out_dir / "label_mapping.json", "w", encoding="utf-8") as f:
        json.dump({"label2id": label2id, "id2label": {str(k): v for k, v in id2label.items()}}, f, ensure_ascii=False, indent=2)
    print(f"[save] modelo -> {out_dir}")
    print(f"[save] métricas -> {out_dir / 'metrics.json'}")


if __name__ == "__main__":
    main()
