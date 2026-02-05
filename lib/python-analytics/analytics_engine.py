"""
Scientific Analytics Engine for AI Discovery

This module performs REAL statistical analysis on astronomical data:
- Pearson & Spearman correlations with p-values
- Linear regression with coefficients and confidence intervals
- Outlier detection with z-scores
- Numeric predictions based on regression models

ALL COMPUTATIONS ARE DETERMINISTIC. Results are passed to LLM for interpretation only.
"""

import json
import sys
import warnings
from typing import Any, Optional

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')


def compute_correlations(df: pd.DataFrame, numeric_cols: list[str]) -> list[dict]:
    """
    Compute Pearson and Spearman correlations between all numeric column pairs.
    Returns correlations with r-values AND p-values.
    """
    correlations = []
    
    for i, col1 in enumerate(numeric_cols):
        for col2 in numeric_cols[i+1:]:
            # Get paired valid values
            mask = df[[col1, col2]].notna().all(axis=1)
            x = df.loc[mask, col1].values
            y = df.loc[mask, col2].values
            
            if len(x) < 5:
                continue
            
            # Pearson correlation
            try:
                pearson_r, pearson_p = stats.pearsonr(x, y)
            except Exception:
                pearson_r, pearson_p = 0.0, 1.0
            
            # Spearman correlation (rank-based, robust to outliers)
            try:
                spearman_r, spearman_p = stats.spearmanr(x, y)
            except Exception:
                spearman_r, spearman_p = 0.0, 1.0
            
            # Only include significant correlations (p < 0.05 or |r| > 0.3)
            if abs(pearson_r) > 0.3 or pearson_p < 0.05:
                correlations.append({
                    "x": col1,
                    "y": col2,
                    "pearson_r": round(float(pearson_r), 4),
                    "pearson_p": round(float(pearson_p), 6),
                    "spearman_r": round(float(spearman_r), 4),
                    "spearman_p": round(float(spearman_p), 6),
                    "n_samples": int(len(x)),
                    "is_significant": pearson_p < 0.05
                })
    
    # Sort by absolute correlation strength
    correlations.sort(key=lambda c: abs(c["pearson_r"]), reverse=True)
    return correlations[:20]  # Top 20 correlations


def compute_regressions(df: pd.DataFrame, numeric_cols: list[str]) -> list[dict]:
    """
    Compute linear regressions for strongly correlated pairs.
    Returns slope, intercept, R², and predicted values.
    """
    regressions = []
    
    # First compute correlations to find good regression candidates
    for i, target in enumerate(numeric_cols):
        for feature in numeric_cols:
            if feature == target:
                continue
            
            # Get paired valid values
            mask = df[[target, feature]].notna().all(axis=1)
            y = df.loc[mask, target].values.reshape(-1, 1)
            X = df.loc[mask, feature].values.reshape(-1, 1)
            
            if len(y) < 10:
                continue
            
            # Check correlation first
            try:
                r, p = stats.pearsonr(X.flatten(), y.flatten())
            except Exception:
                continue
            
            # Only regress if meaningful correlation
            if abs(r) < 0.4:
                continue
            
            # Fit linear regression
            model = LinearRegression()
            model.fit(X, y)
            
            slope = float(model.coef_[0][0])
            intercept = float(model.intercept_[0])
            r2 = float(model.score(X, y))
            
            # Compute residuals for confidence
            predictions = model.predict(X).flatten()
            residuals = y.flatten() - predictions
            std_error = float(np.std(residuals))
            
            # Generate some sample predictions
            X_range = np.linspace(X.min(), X.max(), 5).reshape(-1, 1)
            y_pred = model.predict(X_range).flatten()
            
            sample_predictions = [
                {
                    "input_value": round(float(x[0]), 4),
                    "predicted_value": round(float(p), 4),
                    "confidence_interval": [
                        round(float(p - 1.96 * std_error), 4),
                        round(float(p + 1.96 * std_error), 4)
                    ]
                }
                for x, p in zip(X_range, y_pred)
            ]
            
            regressions.append({
                "target": target,
                "feature": feature,
                "slope": round(slope, 6),
                "intercept": round(intercept, 6),
                "r2": round(r2, 4),
                "correlation": round(float(r), 4),
                "p_value": round(float(p), 6),
                "std_error": round(std_error, 6),
                "n_samples": int(len(y)),
                "sample_predictions": sample_predictions
            })
    
    # Sort by R² (best models first)
    regressions.sort(key=lambda r: r["r2"], reverse=True)
    return regressions[:10]  # Top 10 regressions


def detect_outliers(df: pd.DataFrame, numeric_cols: list[str]) -> list[dict]:
    """
    Detect outliers using both z-score and IQR methods.
    Returns actual outlier values with their row indices.
    """
    outliers = []
    
    for col in numeric_cols:
        values = df[col].dropna()
        
        if len(values) < 10:
            continue
        
        # Z-score method
        mean = float(values.mean())
        std = float(values.std())
        
        if std == 0:
            continue
        
        z_scores = np.abs((values - mean) / std)
        z_outlier_mask = z_scores > 3.0
        
        # IQR method
        q1, q3 = values.quantile([0.25, 0.75])
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        iqr_outlier_mask = (values < lower_bound) | (values > upper_bound)
        
        # Combine (outlier by either method)
        combined_mask = z_outlier_mask | iqr_outlier_mask
        
        if combined_mask.sum() == 0:
            continue
        
        # Get actual outlier values
        outlier_values = values[combined_mask]
        outlier_details = []
        
        for idx, val in outlier_values.head(10).items():  # Limit to 10 per field
            z = float(z_scores.loc[idx]) if idx in z_scores.index else 0
            outlier_details.append({
                "row_index": int(idx),
                "value": round(float(val), 6),
                "z_score": round(z, 2),
                "is_extreme": z > 4.0 or val < lower_bound - iqr or val > upper_bound + iqr
            })
        
        outliers.append({
            "field": col,
            "total_outliers": int(combined_mask.sum()),
            "outlier_ratio": round(float(combined_mask.sum() / len(values)), 4),
            "mean": round(mean, 6),
            "std": round(std, 6),
            "lower_bound": round(float(lower_bound), 6),
            "upper_bound": round(float(upper_bound), 6),
            "outlier_details": outlier_details
        })
    
    # Sort by outlier ratio
    outliers.sort(key=lambda o: o["outlier_ratio"], reverse=True)
    return outliers


def compute_field_statistics(df: pd.DataFrame, numeric_cols: list[str]) -> list[dict]:
    """
    Compute comprehensive statistics for each numeric field.
    """
    field_stats = []
    
    for col in numeric_cols:
        values = df[col].dropna()
        
        if len(values) == 0:
            continue
        
        # Basic statistics
        mean = float(values.mean())
        median = float(values.median())
        std = float(values.std())
        min_val = float(values.min())
        max_val = float(values.max())
        
        # Quartiles
        q1 = float(values.quantile(0.25))
        q3 = float(values.quantile(0.75))
        
        # Skewness and kurtosis (distribution shape)
        try:
            skewness = float(stats.skew(values))
            kurtosis = float(stats.kurtosis(values))
        except Exception:
            skewness = 0.0
            kurtosis = 0.0
        
        # Normality test (Shapiro-Wilk, max 5000 samples)
        sample = values.sample(min(5000, len(values)), random_state=42)
        try:
            _, normality_p = stats.shapiro(sample)
            is_normal = normality_p > 0.05
        except Exception:
            normality_p = 0.0
            is_normal = False
        
        field_stats.append({
            "field": col,
            "count": int(len(values)),
            "null_count": int(df[col].isna().sum()),
            "mean": round(mean, 6),
            "median": round(median, 6),
            "std": round(std, 6),
            "min": round(min_val, 6),
            "max": round(max_val, 6),
            "range": round(max_val - min_val, 6),
            "q1": round(q1, 6),
            "q3": round(q3, 6),
            "iqr": round(q3 - q1, 6),
            "skewness": round(skewness, 4),
            "kurtosis": round(kurtosis, 4),
            "is_normal_distribution": is_normal,
            "normality_p_value": round(float(normality_p), 6),
            "coefficient_of_variation": round(std / abs(mean) if mean != 0 else 0, 4)
        })
    
    return field_stats


def generate_numeric_predictions(
    df: pd.DataFrame,
    regressions: list[dict],
    field_stats: list[dict]
) -> list[dict]:
    """
    Generate actual numeric predictions based on regression models.
    These are COMPUTED predictions, not LLM-generated.
    """
    predictions = []
    
    for reg in regressions[:5]:  # Top 5 regressions
        if reg["r2"] < 0.5:  # Only make predictions from strong models
            continue
        
        target = reg["target"]
        feature = reg["feature"]
        slope = reg["slope"]
        intercept = reg["intercept"]
        std_error = reg["std_error"]
        
        # Find feature statistics
        feature_stats = next((s for s in field_stats if s["field"] == feature), None)
        target_stats = next((s for s in field_stats if s["field"] == target), None)
        
        if not feature_stats or not target_stats:
            continue
        
        # Predict at feature boundaries
        predictions.append({
            "type": "regression_based",
            "target_field": target,
            "predictor_field": feature,
            "model_r2": reg["r2"],
            "model_equation": f"{target} = {slope:.4f} * {feature} + {intercept:.4f}",
            "predictions_at_boundaries": {
                "at_min": {
                    "input": round(feature_stats["min"], 4),
                    "predicted": round(slope * feature_stats["min"] + intercept, 4),
                    "ci_lower": round(slope * feature_stats["min"] + intercept - 1.96 * std_error, 4),
                    "ci_upper": round(slope * feature_stats["min"] + intercept + 1.96 * std_error, 4)
                },
                "at_mean": {
                    "input": round(feature_stats["mean"], 4),
                    "predicted": round(slope * feature_stats["mean"] + intercept, 4),
                    "ci_lower": round(slope * feature_stats["mean"] + intercept - 1.96 * std_error, 4),
                    "ci_upper": round(slope * feature_stats["mean"] + intercept + 1.96 * std_error, 4)
                },
                "at_max": {
                    "input": round(feature_stats["max"], 4),
                    "predicted": round(slope * feature_stats["max"] + intercept, 4),
                    "ci_lower": round(slope * feature_stats["max"] + intercept - 1.96 * std_error, 4),
                    "ci_upper": round(slope * feature_stats["max"] + intercept + 1.96 * std_error, 4)
                }
            },
            "interpretation_hint": (
                f"For every unit increase in {feature}, "
                f"{target} {'increases' if slope > 0 else 'decreases'} "
                f"by {abs(slope):.4f} units"
            ),
            "confidence": "high" if reg["r2"] > 0.7 else "medium"
        })
    
    return predictions


def run_analytics(data: dict) -> dict:
    """
    Main entry point for analytics engine.
    
    Args:
        data: Dictionary with 'rows' (list of row dicts) and 'columns' (list of column names)
    
    Returns:
        Complete analytics results as structured JSON
    """
    # Convert to DataFrame
    rows = data.get("rows", [])
    if not rows:
        return {"error": "No data rows provided"}
    
    df = pd.DataFrame(rows)
    
    # Identify numeric columns
    numeric_cols = []
    for col in df.columns:
        try:
            # Try to convert to numeric
            numeric_vals = pd.to_numeric(df[col], errors='coerce')
            valid_count = numeric_vals.notna().sum()
            if valid_count > len(df) * 0.5:  # At least 50% valid numeric
                df[col] = numeric_vals
                numeric_cols.append(col)
        except Exception:
            pass
    
    if not numeric_cols:
        return {"error": "No numeric columns found in data"}
    
    # Run all analyses
    field_stats = compute_field_statistics(df, numeric_cols)
    correlations = compute_correlations(df, numeric_cols)
    regressions = compute_regressions(df, numeric_cols)
    outliers = detect_outliers(df, numeric_cols)
    predictions = generate_numeric_predictions(df, regressions, field_stats)
    
    return {
        "summary": {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "numeric_columns": len(numeric_cols),
            "numeric_column_names": numeric_cols
        },
        "field_statistics": field_stats,
        "correlations": correlations,
        "regressions": regressions,
        "outliers": outliers,
        "computed_predictions": predictions,
        "analysis_complete": True
    }


def main():
    """
    CLI entry point. Reads JSON from stdin, writes results to stdout.
    """
    import traceback
    
    try:
        # Debug: check if we can read stdin
        import sys
        
        # Read input JSON
        raw_input = sys.stdin.read()
        
        if not raw_input:
            print(json.dumps({
                "error": "No input data received on stdin",
                "analysis_complete": False,
                "debug": "stdin was empty"
            }))
            sys.exit(1)
        
        try:
            input_data = json.loads(raw_input)
        except json.JSONDecodeError as je:
            print(json.dumps({
                "error": f"Invalid JSON input: {str(je)}",
                "analysis_complete": False,
                "debug": f"First 200 chars: {raw_input[:200]}"
            }))
            sys.exit(1)
        
        # Run analytics
        results = run_analytics(input_data)
        
        # Validate output
        if not isinstance(results, dict):
            print(json.dumps({
                "error": "Analytics returned non-dict result",
                "analysis_complete": False
            }))
            sys.exit(1)
        
        # Output results (compact for smaller payload)
        print(json.dumps(results))
        
    except Exception as e:
        # Full traceback for debugging
        tb = traceback.format_exc()
        print(json.dumps({
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": tb,
            "analysis_complete": False
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
