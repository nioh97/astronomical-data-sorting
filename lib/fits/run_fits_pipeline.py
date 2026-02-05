"""
FITS pipeline — parse, analyze, visualize; ALWAYS print valid JSON to stdout.
Usage: python run_fits_pipeline.py <fits_path> <previews_dir> [file_name]
Never print stack traces or warnings. Never exit non-zero unless Python cannot start.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
import warnings

warnings.simplefilter("ignore")

import matplotlib
matplotlib.use("Agg")

# Load hyphenated modules (fits-parser.py etc.) via importlib
_script_dir = os.path.dirname(os.path.abspath(__file__))


def _load_module(name: str, filename: str):
    import importlib.util
    path = os.path.join(_script_dir, filename)
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {filename}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_parser = _load_module("fits_parser", "fits-parser.py")
_analyzer = _load_module("fits_analyzer", "fits-analyzer.py")
_visualizer = _load_module("fits_visualizer", "fits-visualizer.py")
get_summary = _parser.get_summary
analyze = _analyzer.analyze
visualize = _visualizer.visualize

PLOTTABLE = ("image", "error_map", "low_contrast_image", "spectrum", "light_curve", "table")


def run_pipeline(fits_path: str, previews_dir: str, file_name: str | None = None) -> dict:
    """
    Run parser -> analyzer -> visualizer. ALWAYS return valid JSON-shaped dict.
    status: success | valid_no_visualizable_data | error
    """
    base_name = file_name or os.path.basename(fits_path)
    warnings_list: list[str] = []

    summaries = get_summary(fits_path)
    if isinstance(summaries, dict) and "__error__" in summaries:
        return {
            "status": "error",
            "fileName": base_name,
            "hdus": [],
            "warnings": warnings_list,
            "error": summaries["__error__"],
        }

    if not summaries or len(summaries) == 0:
        return {
            "status": "valid_no_visualizable_data",
            "message": "This FITS file is valid but contains no plottable HDUs.",
            "fileName": base_name,
            "hdus": [],
            "warnings": warnings_list,
            "error": None,
        }

    # Only mark error when no HDU contains numeric data (visualization failure != corrupted)
    has_any_numeric = any(s.get("has_numeric_data") for s in summaries if isinstance(s, dict))
    if not has_any_numeric:
        return {
            "status": "error",
            "fileName": base_name,
            "hdus": [],
            "warnings": warnings_list,
            "error": "No HDU contains numeric image data.",
        }

    try:
        analyzed = analyze(fits_path, summaries)
    except Exception as e:
        return {
            "status": "error",
            "fileName": base_name,
            "hdus": [],
            "warnings": warnings_list,
            "error": str(e),
        }

    has_plottable = any(
        a.get("classification") in PLOTTABLE
        for a in analyzed
    )
    if not has_plottable:
        return {
            "status": "valid_no_visualizable_data",
            "message": "This FITS file is valid but contains no plottable HDUs.",
            "fileName": base_name,
            "hdus": [],
            "warnings": warnings_list,
            "error": None,
        }

    file_id = str(uuid.uuid4())[:8]
    try:
        os.makedirs(previews_dir, exist_ok=True)
        preview_urls = visualize(fits_path, analyzed, previews_dir, file_id=file_id)
    except Exception as e:
        preview_urls = [None] * len(analyzed)
        warnings_list.append(str(e))

    hdus = []
    for i, a in enumerate(analyzed):
        preview_url = preview_urls[i] if i < len(preview_urls) else None
        hdus.append({
            "index": a.get("hdu_index", i),
            "type": a.get("hdu_type", "Unknown"),
            "classification": a.get("classification", "unknown"),
            "previewImage": preview_url,
            "metadata": a.get("header", {}),
            "units": a.get("units", {}),
        })

    return {
        "status": "success",
        "fileName": base_name,
        "hdus": hdus,
        "warnings": warnings_list,
        "error": None,
    }


def main() -> None:
    if len(sys.argv) < 3:
        out = {
            "status": "error",
            "fileName": "",
            "hdus": [],
            "warnings": [],
            "error": "Usage: run_fits_pipeline.py <fits_path> <previews_dir> [file_name]",
        }
        print(json.dumps(out))
        sys.exit(0)
    fits_path = sys.argv[1]
    previews_dir = sys.argv[2]
    file_name = sys.argv[3] if len(sys.argv) > 3 else None
    try:
        result = run_pipeline(fits_path, previews_dir, file_name)
    except Exception as e:
        result = {
            "status": "error",
            "fileName": file_name or (os.path.basename(fits_path) if fits_path else ""),
            "hdus": [],
            "warnings": [],
            "error": str(e),
        }
    print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()
