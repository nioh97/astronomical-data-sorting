# FITS Pipeline — Temporary Test Checklist (MANDATORY)

Use this checklist to verify FITS uploads behave correctly. **Valid files must NOT show "corrupt".**

## Test cases

| Test | Description | Expected |
|------|-------------|----------|
| ✅ Image FITS | 2D array (e.g. PrimaryHDU or ImageHDU with NAXIS=2) | Previews render; no "corrupt" |
| ✅ Spectrum FITS | Table with wavelength + flux columns | Line plot preview; no "corrupt" |
| ✅ Light-curve FITS | Table with time + flux columns | Time vs flux plot; no "corrupt" |
| ✅ Header-only FITS | Valid FITS with no plottable HDUs | Info: "valid but contains no visualizable data products"; 200; no "corrupt" |
| ✅ Compressed .fz | FITS compressed with fpack | Parses and previews when plottable; no "corrupt" |
| ✅ Large FITS | File > 100MB | Does not block UI; previews when possible or valid_no_visualizable_data |
| ❌ Truly corrupted FITS | Invalid/corrupt file (not openable by astropy) | 400 "could not be processed" or 500; only then use internal "corrupt" wording if astropy fails to open |

## Pass criteria

- All valid files (first six rows) do **not** display "corrupt" or "unsupported or corrupted".
- Header-only / no plottable HDUs returns **200** with `status: valid_no_visualizable_data` and info banner.
- Partial results: if some HDUs fail to visualize, others still show previews (`previewImage` null for failed HDUs only).
- CSV/JSON/XML ingestion and LLM/unit flows are **unchanged**.

---

*Remove or archive this file after validation.*
