"""
FITS visualizer — generate PNG previews for images (ZScale/percentile) and
tables (light curve, spectrum, scatter). Downsample tables > 50k rows.
Saves to given previews directory. Each HDU visualization is wrapped in try/except;
one bad HDU must NOT block others; failed HDUs get preview null.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
import warnings
from typing import Any

warnings.simplefilter("ignore")

import matplotlib
matplotlib.use("Agg")

try:
    import numpy as np
except ImportError:
    np = None  # type: ignore

try:
    from astropy.io import fits
    from astropy.visualization import (
        ZScaleInterval,
        ImageNormalize,
        AsinhStretch,
        LinearStretch,
    )
except ImportError:
    fits = None  # type: ignore
    ZScaleInterval = None  # type: ignore
    ImageNormalize = None  # type: ignore
    AsinhStretch = None  # type: ignore
    LinearStretch = None  # type: ignore

try:
    import matplotlib.pyplot as plt
except ImportError:
    plt = None  # type: ignore

MAX_TABLE_ROWS = 50_000
CLASSIFICATION_IMAGE = "image"
CLASSIFICATION_ERROR_MAP = "error_map"
CLASSIFICATION_LOW_CONTRAST_IMAGE = "low_contrast_image"
CLASSIFICATION_SPECTRUM = "spectrum"
CLASSIFICATION_LIGHT_CURVE = "light_curve"
CLASSIFICATION_TABLE = "table"
CLASSIFICATION_UNKNOWN = "unknown"
IMAGE_LIKE = (CLASSIFICATION_IMAGE, CLASSIFICATION_ERROR_MAP, CLASSIFICATION_LOW_CONTRAST_IMAGE)


def _get_interval_limits(data: "np.ndarray") -> tuple[float, float]:
    """ZScale first; if fail or min==max use percentile [1,99]; if still flat use nanmin/nanmax or vmin+1e-6."""
    if ZScaleInterval is not None and np is not None:
        try:
            interval = ZScaleInterval()
            vmin, vmax = interval.get_limits(data)
            if np.isfinite(vmin) and np.isfinite(vmax) and vmin != vmax:
                return (float(vmin), float(vmax))
        except Exception:
            pass
    if np is not None:
        try:
            vmin, vmax = float(np.nanpercentile(data, 1)), float(np.nanpercentile(data, 99))
            if np.isfinite(vmin) and np.isfinite(vmax) and vmin != vmax:
                return (vmin, vmax)
        except Exception:
            pass
    if np is not None:
        try:
            vmin = float(np.nanmin(data))
            vmax = float(np.nanmax(data))
            if not np.isfinite(vmin):
                vmin = 0.0
            if not np.isfinite(vmax) or vmax == vmin:
                vmax = vmin + 1e-6
            return (vmin, vmax)
        except Exception:
            pass
    return (0.0, 1.0)


def _render_image(fits_path: str, hdu_index: int, out_path: str) -> bool:
    """Always attempt ZScale; fallback percentile then min/max. AsinhStretch by default; colorbar; always save PNG if data exists."""
    if fits is None or np is None or plt is None:
        return False
    try:
        with fits.open(fits_path, lazy_load_hdus=False, memmap=True) as hdul:
            if hdu_index >= len(hdul):
                return False
            hdu = hdul[hdu_index]
            data = getattr(hdu, "data", None)
            if data is None:
                return False
            arr = np.asarray(data, dtype=np.float64)
            if arr.ndim != 2:
                return False
            vmin, vmax = _get_interval_limits(arr)
            if not np.isfinite(vmin) or vmin == vmax:
                vmin = float(np.nanmin(arr))
                vmax = float(np.nanmax(arr)) if np.isfinite(np.nanmax(arr)) and np.nanmax(arr) != vmin else vmin + 1e-6
            # ImageNormalize + AsinhStretch (or LinearStretch if flat) for error maps / flat / low-contrast
            norm = None
            if ImageNormalize is not None and (AsinhStretch is not None and LinearStretch is not None):
                stretch = AsinhStretch() if vmax > vmin else LinearStretch()
                norm = ImageNormalize(vmin=vmin, vmax=vmax, stretch=stretch)
            fig, ax = plt.subplots(figsize=(6, 5))
            if norm is not None:
                im = ax.imshow(arr, cmap="gray", norm=norm, aspect="auto", origin="lower")
            else:
                im = ax.imshow(arr, cmap="gray", vmin=vmin, vmax=vmax, aspect="auto", origin="lower")
            plt.colorbar(im, ax=ax, label="Pixel value")
            ax.set_axis_off()
            plt.tight_layout(pad=0.1)
            plt.savefig(out_path, dpi=100, bbox_inches="tight", pad_inches=0.05)
            plt.close(fig)
            return True
    except Exception:
        return False


def _downsample_indices(n: int, max_n: int) -> "np.ndarray":
    """Evenly sample up to max_n indices."""
    if np is None or n <= max_n:
        return np.arange(n) if np is not None else list(range(n))
    indices = np.linspace(0, n - 1, max_n, dtype=int)
    return np.unique(indices)


def _first_numeric_columns(table: "fits.FITS_rec", col_names: list[str]) -> tuple[str, str]:
    """First two columns that are numeric (for scatter)."""
    if not col_names or table is None:
        return ("", "")
    numeric = []
    try:
        ncol = len(table.columns)
        for i, name in enumerate(col_names):
            if i >= ncol:
                break
            col = table.columns[i]
            fmt = getattr(col, "format", "") or ""
            if any(c in str(fmt) for c in ("E", "D", "I", "J", "K")):
                numeric.append(name)
    except Exception:
        pass
    if len(numeric) >= 2:
        return (numeric[0], numeric[1])
    if len(numeric) == 1:
        return (numeric[0], "")
    return (col_names[0] if col_names else "", col_names[1] if len(col_names) > 1 else "")


def _time_flux_columns(col_names: list[str], table: "fits.FITS_rec") -> tuple[str, str]:
    """Heuristic: time-like and flux-like column names."""
    time_like = {"time", "mjd", "jd", "date", "epoch", "bjd", "day"}
    flux_like = {"flux", "count", "rate", "counts", "mag", "magnitude", "fluxerr", "flux_err"}
    time_col = ""
    flux_col = ""
    for c in col_names:
        n = c.replace("_", "").replace(" ", "").lower()
        if n in time_like:
            time_col = c
        if n in flux_like or "flux" in n or "count" in n:
            flux_col = c
    if not time_col and col_names:
        time_col = col_names[0]
    if not flux_col and len(col_names) > 1:
        flux_col = col_names[1]
    return (time_col, flux_col)


def _wavelength_flux_columns(col_names: list[str]) -> tuple[str, str]:
    wl_like = {"wavelength", "wave", "wl", "lam", "lambda", "energy", "freq", "frequency"}
    flux_like = {"flux", "count", "rate", "counts", "mag", "magnitude"}
    wl_col = ""
    flux_col = ""
    for c in col_names:
        n = c.replace("_", "").replace(" ", "").lower()
        if n in wl_like or "wave" in n or "lam" in n:
            wl_col = c
        if n in flux_like or "flux" in n:
            flux_col = c
    if not wl_col and col_names:
        wl_col = col_names[0]
    if not flux_col and len(col_names) > 1:
        flux_col = col_names[1]
    return (wl_col, flux_col)


def _render_light_curve(fits_path: str, hdu_index: int, col_names: list[str], out_path: str) -> bool:
    if fits is None or np is None or plt is None:
        return False
    try:
        with fits.open(fits_path, memmap=True) as hdul:
            if hdu_index >= len(hdul):
                return False
            hdu = hdul[hdu_index]
            data = getattr(hdu, "data", None)
            if data is None:
                return False
            time_col, flux_col = _time_flux_columns(col_names, data)
            if not time_col or not flux_col:
                return False
            x = np.asarray(data[time_col], dtype=float)
            y = np.asarray(data[flux_col], dtype=float)
            n = len(x)
            if n > MAX_TABLE_ROWS:
                idx = _downsample_indices(n, MAX_TABLE_ROWS)
                x, y = x[idx], y[idx]
            fig, ax = plt.subplots(figsize=(6, 4))
            ax.plot(x, y, "b-", linewidth=0.5)
            ax.set_xlabel(time_col)
            ax.set_ylabel(flux_col)
            plt.tight_layout()
            plt.savefig(out_path, dpi=100, bbox_inches="tight")
            plt.close(fig)
            return True
    except Exception:
        return False


def _render_spectrum(fits_path: str, hdu_index: int, col_names: list[str], out_path: str) -> bool:
    if fits is None or np is None or plt is None:
        return False
    try:
        with fits.open(fits_path, memmap=True) as hdul:
            if hdu_index >= len(hdul):
                return False
            hdu = hdul[hdu_index]
            data = getattr(hdu, "data", None)
            if data is None:
                return False
            wl_col, flux_col = _wavelength_flux_columns(col_names)
            if not wl_col or not flux_col:
                return False
            x = np.asarray(data[wl_col], dtype=float)
            y = np.asarray(data[flux_col], dtype=float)
            n = len(x)
            if n > MAX_TABLE_ROWS:
                idx = _downsample_indices(n, MAX_TABLE_ROWS)
                x, y = x[idx], y[idx]
            fig, ax = plt.subplots(figsize=(6, 4))
            ax.plot(x, y, "b-", linewidth=0.5)
            ax.set_xlabel(wl_col)
            ax.set_ylabel(flux_col)
            plt.tight_layout()
            plt.savefig(out_path, dpi=100, bbox_inches="tight")
            plt.close(fig)
            return True
    except Exception:
        return False


def _render_table_scatter(fits_path: str, hdu_index: int, col_names: list[str], out_path: str) -> bool:
    if fits is None or np is None or plt is None:
        return False
    try:
        with fits.open(fits_path, memmap=True) as hdul:
            if hdu_index >= len(hdul):
                return False
            hdu = hdul[hdu_index]
            data = getattr(hdu, "data", None)
            if data is None:
                return False
            c1, c2 = _first_numeric_columns(data, col_names)
            if not c1:
                return False
            x = np.asarray(data[c1], dtype=float)
            if c2:
                y = np.asarray(data[c2], dtype=float)
            else:
                y = np.arange(len(x), dtype=float)
            n = len(x)
            if n > MAX_TABLE_ROWS:
                idx = _downsample_indices(n, MAX_TABLE_ROWS)
                x, y = x[idx], y[idx]
            fig, ax = plt.subplots(figsize=(6, 4))
            ax.scatter(x, y, s=1, alpha=0.6)
            ax.set_xlabel(c1)
            ax.set_ylabel(c2 if c2 else "index")
            plt.tight_layout()
            plt.savefig(out_path, dpi=100, bbox_inches="tight")
            plt.close(fig)
            return True
    except Exception:
        return False


def visualize_hdu(
    fits_path: str,
    analysis: dict[str, Any],
    previews_dir: str,
    file_id: str,
) -> str | None:
    """
    Generate one preview PNG for the HDU. Returns relative URL or None.
    Wrapped in try/except so one bad HDU does NOT block others.
    """
    try:
        os.makedirs(previews_dir, exist_ok=True)
        hdu_index = analysis.get("hdu_index", 0)
        classification = analysis.get("classification", CLASSIFICATION_UNKNOWN)
        col_names = analysis.get("column_names", [])
        base = f"fits_{file_id}_hdu_{hdu_index}"
        out_path = os.path.join(previews_dir, f"{base}.png")

        ok = False
        if classification in IMAGE_LIKE:
            ok = _render_image(fits_path, hdu_index, out_path)
        elif classification == CLASSIFICATION_LIGHT_CURVE:
            ok = _render_light_curve(fits_path, hdu_index, col_names, out_path)
        elif classification == CLASSIFICATION_SPECTRUM:
            ok = _render_spectrum(fits_path, hdu_index, col_names, out_path)
        elif classification == CLASSIFICATION_TABLE:
            ok = _render_table_scatter(fits_path, hdu_index, col_names, out_path)
        else:
            ok = _render_image(fits_path, hdu_index, out_path)  # try image for unknown/PrimaryHDU

        if ok:
            return f"/previews/{base}.png"
    except Exception:
        pass
    return None


def visualize(
    fits_path: str,
    analyses: list[dict[str, Any]],
    previews_dir: str,
    file_id: str | None = None,
) -> list[str | None]:
    """Generate preview for each HDU; failed HDUs get None. One bad HDU does NOT block others."""
    fid = file_id or str(uuid.uuid4())[:8]
    urls: list[str | None] = []
    for a in analyses:
        try:
            url = visualize_hdu(fits_path, a, previews_dir, fid)
            urls.append(url)
        except Exception:
            urls.append(None)
    return urls


def main() -> None:
    if len(sys.argv) < 4:
        out = {"status": "error", "error": "Usage: fits-visualizer.py <fits_path> <analyzer_json_path> <previews_dir>", "hdus": [], "warnings": []}
        print(json.dumps(out))
        sys.exit(0)
    fits_path = sys.argv[1]
    analyzer_json_path = sys.argv[2]
    previews_dir = sys.argv[3]
    try:
        with open(analyzer_json_path, "r", encoding="utf-8") as f:
            analyses = json.load(f)
        urls = visualize(fits_path, analyses, previews_dir)
        print(json.dumps(urls))
    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e), "hdus": [], "warnings": []}))
    sys.exit(0)


if __name__ == "__main__":
    main()
