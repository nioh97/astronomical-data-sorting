"""
FITS analyzer — classify each HDU (image, spectrum, light_curve, table, unknown),
extract axis meaning, units, column descriptions. Best-effort; never fail.
"""

from __future__ import annotations

import json
import re
import sys
import warnings
from typing import Any

warnings.simplefilter("ignore")

try:
    from astropy.io import fits
except ImportError:
    fits = None  # type: ignore

CLASSIFICATION_IMAGE = "image"
CLASSIFICATION_ERROR_MAP = "error_map"
CLASSIFICATION_LOW_CONTRAST_IMAGE = "low_contrast_image"
CLASSIFICATION_SPECTRUM = "spectrum"
CLASSIFICATION_LIGHT_CURVE = "light_curve"
CLASSIFICATION_TABLE = "table"
CLASSIFICATION_UNKNOWN = "unknown"


def _column_names_from_header(header: "fits.Header | None") -> list[str]:
    """Get table column names from TTYPE1, TTYPE2, ... without loading data."""
    if header is None:
        return []
    names = []
    for i in range(1, 1000):
        key = f"TTYPE{i}"
        if key not in header:
            break
        try:
            names.append(str(header.get(key, "")).strip())
        except Exception:
            names.append("")
    return names


def _normalize_col(s: str) -> str:
    return re.sub(r"[_\s]", "", s).lower()


def _has_time_like(cols: list[str]) -> bool:
    time_like = {"time", "mjd", "jd", "date", "epoch", "bjd", "day"}
    for c in cols:
        if _normalize_col(c) in time_like:
            return True
    return False


def _has_flux_like(cols: list[str]) -> bool:
    flux_like = {"flux", "count", "rate", "counts", "mag", "magnitude", "fluxerr", "flux_err"}
    for c in cols:
        n = _normalize_col(c)
        if n in flux_like or "flux" in n or "count" in n:
            return True
    return False


def _has_wavelength_like(cols: list[str]) -> bool:
    wl_like = {"wavelength", "wave", "wl", "lam", "lambda", "energy", "freq", "frequency"}
    for c in cols:
        n = _normalize_col(c)
        if n in wl_like or "wave" in n or "lam" in n:
            return True
    return False


def _classify_table(cols: list[str]) -> str:
    if not cols:
        return CLASSIFICATION_TABLE
    if _has_time_like(cols) and _has_flux_like(cols):
        return CLASSIFICATION_LIGHT_CURVE
    if _has_wavelength_like(cols) and _has_flux_like(cols):
        return CLASSIFICATION_SPECTRUM
    return CLASSIFICATION_TABLE


def _get_table_units(header: "fits.Header | None") -> dict[str, str]:
    """TUNITn -> unit string; map by TTYPEn name when possible."""
    if header is None:
        return {}
    units: dict[str, str] = {}
    names = _column_names_from_header(header)
    for i, name in enumerate(names, start=1):
        key = f"TUNIT{i}"
        if key in header and name:
            try:
                units[name] = str(header.get(key, "")).strip()
            except Exception:
                pass
    if "BUNIT" in header:
        units["BUNIT"] = str(header.get("BUNIT", "")).strip()
    return units


def _axis_meaning(header: dict[str, Any], classification: str) -> dict[str, str]:
    """Best-effort axis labels from header (CTYPE, etc.)."""
    out: dict[str, str] = {}
    for k, v in header.items():
        if k.startswith("CTYPE") and isinstance(v, str):
            out[k] = str(v).strip()
    return out


def _is_plottable_classification(c: str) -> bool:
    return c in (CLASSIFICATION_IMAGE, CLASSIFICATION_ERROR_MAP, CLASSIFICATION_LOW_CONTRAST_IMAGE, CLASSIFICATION_SPECTRUM, CLASSIFICATION_LIGHT_CURVE, CLASSIFICATION_TABLE)


def _header_suggests_error_map(header_dict: dict[str, Any]) -> bool:
    """If DATATYPE (or similar) contains 'error' or 'uncertainty' -> error_map."""
    datatype = (header_dict.get("DATATYPE") or header_dict.get("HDUCLAS1") or header_dict.get("EXTNAME") or "")
    s = str(datatype).lower()
    return "error" in s or "uncertainty" in s


def _header_suggests_low_contrast(header_dict: dict[str, Any], summary: dict[str, Any]) -> bool:
    """If BITPIX < 0 and variance is low (is_uniform from parser) -> low_contrast_image."""
    try:
        bitpix = header_dict.get("BITPIX")
        if bitpix is None:
            return False
        bp = int(bitpix)
        if bp >= 0:
            return False
        is_uniform = summary.get("is_uniform", False)
        return is_uniform
    except (TypeError, ValueError):
        return False


def analyze_hdu(fits_path: str, summary: dict[str, Any]) -> dict[str, Any]:
    """
    Classify one HDU and attach classification, units, axis meaning.
    Returns summary dict with added keys: classification, column_names, units, axis_meaning.
    """
    result = dict(summary)
    hdu_type = summary.get("hdu_type", "")
    data_shape = summary.get("data_shape", [])
    header_dict = summary.get("header", {})

    classification = CLASSIFICATION_UNKNOWN
    column_names: list[str] = []
    units: dict[str, str] = dict(summary.get("units", {}))
    axis_meaning: dict[str, str] = _axis_meaning(header_dict, classification)

    try:
        if "ImageHDU" in hdu_type or "PrimaryHDU" in hdu_type:
            ndim = len(data_shape)
            if ndim >= 2:
                if _header_suggests_error_map(header_dict):
                    classification = CLASSIFICATION_ERROR_MAP
                elif _header_suggests_low_contrast(header_dict, summary):
                    classification = CLASSIFICATION_LOW_CONTRAST_IMAGE
                else:
                    classification = CLASSIFICATION_IMAGE
            elif ndim == 1:
                classification = CLASSIFICATION_IMAGE
            else:
                classification = CLASSIFICATION_UNKNOWN
            units = dict(summary.get("units", {}))

        elif "BinTableHDU" in hdu_type or "TableHDU" in hdu_type:
            if fits is not None:
                with fits.open(fits_path, lazy_load_hdus=True, memmap=True) as hdul:
                    idx = summary.get("hdu_index", 0)
                    if idx < len(hdul):
                        hdu = hdul[idx]
                        hdr = getattr(hdu, "header", None)
                        column_names = _column_names_from_header(hdr)
                        units = _get_table_units(hdr)
            classification = _classify_table(column_names)
        else:
            classification = CLASSIFICATION_UNKNOWN
    except Exception:
        classification = CLASSIFICATION_UNKNOWN

    result["classification"] = classification
    result["column_names"] = column_names
    result["units"] = units
    result["axis_meaning"] = axis_meaning
    return result


def analyze(fits_path: str, parser_summaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Analyze all HDUs; per-HDU errors yield unknown classification, no exception."""
    out = []
    for s in parser_summaries:
        try:
            out.append(analyze_hdu(fits_path, s))
        except Exception:
            fallback = dict(s)
            fallback["classification"] = CLASSIFICATION_UNKNOWN
            fallback["column_names"] = []
            fallback["units"] = fallback.get("units", {})
            fallback["axis_meaning"] = {}
            out.append(fallback)
    return out


def main() -> None:
    if len(sys.argv) < 3:
        out = {"status": "error", "error": "Usage: fits-analyzer.py <fits_path> <parser_json_path>", "hdus": [], "warnings": []}
        print(json.dumps(out))
        sys.exit(0)
    fits_path = sys.argv[1]
    parser_json_path = sys.argv[2]
    try:
        with open(parser_json_path, "r", encoding="utf-8") as f:
            summaries = json.load(f)
        if isinstance(summaries, dict) and "__error__" in summaries:
            print(json.dumps({"status": "error", "error": summaries["__error__"], "hdus": [], "warnings": []}))
        else:
            analyzed = analyze(fits_path, summaries)
            print(json.dumps(analyzed))
    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e), "hdus": [], "warnings": []}))
    sys.exit(0)


if __name__ == "__main__":
    main()
