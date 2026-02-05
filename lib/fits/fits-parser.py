"""
FITS parser — open with astropy, iterate HDUs, extract metadata only.
Never load full data into memory for previews. NEVER throw; return structured error.
Returns a structured summary (no raw arrays) or __error__ dict.
FITS is binary — only astropy is used; no UTF-8 decode or .read().
"""

from __future__ import annotations

import json
import sys
import warnings
from typing import Any

warnings.simplefilter("ignore")

try:
    import numpy as np
except ImportError:
    np = None  # type: ignore

try:
    from astropy.io import fits
except ImportError:
    fits = None  # type: ignore


def safe_open_fits(path: str):
    """Open FITS file. Returns HDUList or {"__error__": str(e)}. Never raises."""
    if fits is None:
        return {"__error__": "astropy is not installed. Install with: pip install astropy (or pip install -r lib/fits/requirements.txt)"}
    try:
        return fits.open(path, memmap=True, lazy_load_hdus=True)
    except Exception as e:
        return {"__error__": str(e)}


def _to_json_safe(val: Any) -> Any:
    """Convert numpy scalars to native Python; non-JSON-safe to string. Never mark corrupt for header values."""
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    try:
        if hasattr(val, "item"):
            return val.item()
    except (ValueError, TypeError):
        pass
    return str(val)


def _clean_header(header: "fits.Header | None") -> dict[str, Any]:
    """Make header serializable: remove empty keys, numpy scalars to native, non-JSON-safe to string."""
    if header is None:
        return {}
    out: dict[str, Any] = {}
    for key in header.keys():
        if key in ("COMMENT", "HISTORY") or (isinstance(key, str) and key.strip() == ""):
            continue
        try:
            k = str(key).strip()
            if not k:
                continue
            val = header.get(key)
            if val is None:
                continue
            safe = _to_json_safe(val)
            if safe is not None:
                out[k] = safe
        except Exception:
            continue
    return out


def _get_units_from_header(header: "fits.Header | None") -> dict[str, str]:
    """Extract BUNIT, TUNITn, CUNITn when present."""
    if header is None:
        return {}
    units: dict[str, str] = {}
    try:
        if "BUNIT" in header:
            units["BUNIT"] = str(header.get("BUNIT", "")).strip()
        for i in range(1, 100):
            k = f"TUNIT{i}"
            if k in header:
                units[k] = str(header.get(k, "")).strip()
            k = f"CUNIT{i}"
            if k in header:
                units[k] = str(header.get(k, "")).strip()
    except Exception:
        pass
    return units


def _data_shape_dtype(hdu: "fits.HDUList | fits.PrimaryHDU | fits.ImageHDU | fits.BinTableHDU") -> tuple[tuple[int, ...], str]:
    """Get shape and dtype from header only — never load .data into memory."""
    try:
        if hasattr(hdu, "header") and hdu.header is not None:
            h = hdu.header
            naxis = int(h.get("NAXIS", 0))
            if naxis == 0:
                return ((), "unknown")
            shape = []
            for i in range(1, naxis + 1):
                shape.append(int(h.get(f"NAXIS{i}", 0)))
            return (tuple(shape), "unknown")
    except Exception:
        pass
    return ((), "unknown")


def _image_stats(data: Any) -> dict[str, Any]:
    """Record min_value, max_value, nan_fraction, is_uniform. Never mark corrupt for small/uniform/zero values."""
    out: dict[str, Any] = {}
    if np is None:
        return out
    try:
        arr = np.asarray(data, dtype=np.float64)
        if arr.ndim < 1:
            return out
        finite = np.isfinite(arr)
        n = arr.size
        if n == 0:
            return out
        nan_frac = float(1 - np.sum(finite) / n)
        out["nan_fraction"] = nan_frac
        flat = arr.flatten()
        valid = flat[np.isfinite(flat)]
        if valid.size == 0:
            out["min_value"] = None
            out["max_value"] = None
            out["is_uniform"] = True
            return out
        vmin = float(np.nanmin(valid))
        vmax = float(np.nanmax(valid))
        out["min_value"] = vmin
        out["max_value"] = vmax
        out["is_uniform"] = (vmin == vmax)
        return out
    except Exception:
        return out


def get_summary(fits_path: str) -> list[dict[str, Any]] | dict[str, Any]:
    """
    Open FITS file and return list of HDU summaries (no raw arrays), or {"__error__": str}.
    Accept any HDU with data not None, numpy.ndarray, finite numeric dtype. Never mark corrupt for
    small/near-zero/uniform values or empty header keys. Record min_value, max_value, nan_fraction, is_uniform for images.
    """
    opened = safe_open_fits(fits_path)
    if isinstance(opened, dict) and "__error__" in opened:
        return opened

    summaries: list[dict[str, Any]] = []
    try:
        with opened as hdul:
            for i, hdu in enumerate(hdul):
                try:
                    hdu_type = type(hdu).__name__
                    header = getattr(hdu, "header", None)
                    shape, dtype = _data_shape_dtype(hdu)
                    units = _get_units_from_header(header)
                    cleaned = _clean_header(header)
                    entry = {
                        "hdu_index": i,
                        "hdu_type": hdu_type,
                        "header": cleaned,
                        "data_shape": list(shape),
                        "data_dtype": dtype,
                        "units": units,
                    }
                    # Record image stats for numeric 2D data; never reject for uniform/small/zero
                    if hasattr(hdu, "data") and hdu.data is not None and np is not None:
                        try:
                            d = hdu.data
                            kind = getattr(getattr(d, "dtype", None), "kind", "")
                            if kind in ("f", "i", "u") and getattr(d, "ndim", 0) >= 2:
                                entry["has_numeric_data"] = True
                                entry.update(_image_stats(d))
                        except Exception:
                            pass
                    summaries.append(entry)
                except Exception:
                    continue
    except Exception:
        return {"__error__": "Failed to iterate HDUs"}

    return summaries


def main() -> None:
    if len(sys.argv) < 2:
        out = {"status": "error", "error": "Usage: fits-parser.py <fits_path>", "hdus": [], "warnings": []}
        print(json.dumps(out))
        sys.exit(0)
    fits_path = sys.argv[1]
    result = get_summary(fits_path)
    if isinstance(result, dict) and "__error__" in result:
        print(json.dumps({"status": "error", "error": result["__error__"], "hdus": [], "warnings": []}))
    else:
        print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()
