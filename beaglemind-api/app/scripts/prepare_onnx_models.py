"""
Utility to prepare offline ONNX models and tokenizers for the API.

What it does:
- Exports ONNX for:
    * Embeddings: BAAI/bge-base-en-v1.5 -> onnx/model.onnx
    * Reranker:  cross-encoder/ms-marco-MiniLM-L-6-v2 -> onnx/cross_encoder.onnx
- Saves tokenizers offline to:
    * onnx/embedding_tokenizer/
    * onnx/reranker_tokenizer/

Requires internet ONCE to download models and export them. After that, the
API runs fully offline using the onnx/ directory mounted into the container.

Usage:
  1) python -m venv .venv && source .venv/bin/activate
  2) pip install -r dev-requirements.txt
  3) python app/scripts/prepare_onnx_models.py

If you want custom paths, set env vars before running:
  EMBEDDING_MODEL=BAAI/bge-base-en-v1.5
  RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
  OUTPUT_DIR=onnx

"""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

from transformers import AutoTokenizer


EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "onnx")).resolve()


def run(cmd: list[str], cwd: Optional[Path] = None):
    print("$", " ".join(cmd))
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def ensure_clean_dir(p: Path):
    if p.exists():
        shutil.rmtree(p)
    p.mkdir(parents=True, exist_ok=True)


def export_onnx(model_id: str, task: str, out_file: Path):
    tmp_dir = out_file.parent / ("_tmp_" + out_file.stem)
    ensure_clean_dir(tmp_dir)

    # Use optimum CLI to export to ONNX
    run([
        "optimum-cli", "export", "onnx",
        "-m", model_id,
        "--task", task,
        "--opset", "13",
        str(tmp_dir),
    ])

    # Move produced model.onnx to the desired filename
    produced = tmp_dir / "model.onnx"
    if not produced.exists():
        raise FileNotFoundError(f"Expected ONNX at {produced}, export may have failed")
    shutil.move(str(produced), str(out_file))
    shutil.rmtree(tmp_dir, ignore_errors=True)


def save_tokenizer(model_id: str, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    tok = AutoTokenizer.from_pretrained(model_id)
    tok.save_pretrained(str(out_dir))


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1) Export embeddings model
    emb_out = OUTPUT_DIR / "model.onnx"
    export_onnx(EMBEDDING_MODEL, task="feature-extraction", out_file=emb_out)
    save_tokenizer(EMBEDDING_MODEL, OUTPUT_DIR / "embedding_tokenizer")

    # 2) Export reranker model (sequence classification)
    rerank_out = OUTPUT_DIR / "cross_encoder.onnx"
    export_onnx(RERANKER_MODEL, task="sequence-classification", out_file=rerank_out)
    save_tokenizer(RERANKER_MODEL, OUTPUT_DIR / "reranker_tokenizer")

    print("\nPrepared offline assets:")
    print(f"- Embedding ONNX:  {emb_out}")
    print(f"- Reranker ONNX:   {rerank_out}")
    print(f"- Embedding tok:   {OUTPUT_DIR / 'embedding_tokenizer'}")
    print(f"- Reranker tok:    {OUTPUT_DIR / 'reranker_tokenizer'}")
    print("\nMount this directory into the API container at /app/onnx (read-only).\n")


if __name__ == "__main__":
    main()
