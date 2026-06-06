from __future__ import annotations

import io
from typing import Any

import polars as pl
from fastapi import FastAPI, File, HTTPException, UploadFile

MAX_BYTES = 5 * 1024 * 1024

app = FastAPI(title="GymJaim Dataset API", version="1.0.0")


def _infer_dtype(series: pl.Series) -> str:
    if series.dtype in (pl.Float64, pl.Float32, pl.Int64, pl.Int32, pl.UInt32):
        return "numeric"
    if series.dtype == pl.Boolean:
        return "bool"
    numeric = series.cast(pl.Float64, strict=False)
    non_null = numeric.drop_nulls()
    if len(non_null) > 0 and non_null.len() / max(series.len(), 1) > 0.6:
        return "numeric"
    return "string"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/datasets/profile")
async def profile_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="CSV exceeds 5 MB limit")
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        df = pl.read_csv(io.BytesIO(raw), infer_schema_length=1000, ignore_errors=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}") from e

    if df.width == 0:
        raise HTTPException(status_code=400, detail="No columns found")

    columns: list[dict[str, Any]] = []
    numeric_columns: list[str] = []

    for name in df.columns:
        s = df[name]
        dtype = _infer_dtype(s)
        non_null = int(s.drop_nulls().len())
        missing = int(s.len()) - non_null
        col_info: dict[str, Any] = {
            "name": name,
            "dtype": dtype,
            "non_null": non_null,
            "missing": missing,
            "samples": [str(v) for v in s.drop_nulls().head(4).to_list()],
        }
        if dtype == "numeric":
            numeric_columns.append(name)
            nums = s.cast(pl.Float64, strict=False).drop_nulls()
            if nums.len() > 0:
                col_info["min"] = float(nums.min())
                col_info["max"] = float(nums.max())
                col_info["mean"] = float(nums.mean())
        columns.append(col_info)

    if len(numeric_columns) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 numeric columns")

    preview = df.head(20).to_dicts()
    preview_rows = [
        {k: (None if v is None else v) for k, v in row.items()} for row in preview
    ]

    return {
        "columns": columns,
        "column_names": df.columns,
        "row_count": int(df.height),
        "numeric_columns": numeric_columns,
        "preview_rows": preview_rows,
    }
