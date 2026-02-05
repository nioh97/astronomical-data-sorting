"""
Utility functions for astronomical visualization pipeline.
Handles column detection, coordinate parsing, and data preprocessing.
"""

import re
import numpy as np
import pandas as pd
from typing import Optional, Tuple, List, Dict, Any

# ============================================================================
# COLUMN DETECTION PATTERNS
# ============================================================================

RA_PATTERNS = [
    r'^ra$', r'^ra_?deg$', r'^right_?ascension$', r'^ra_?icrs$',
    r'^raj2000$', r'^ra_?j2000$', r'^alpha$', r'^ra_?ep$',
    r'^_?ra$', r'^ra_?.*deg.*$'
]

DEC_PATTERNS = [
    r'^dec$', r'^dec_?deg$', r'^declination$', r'^dec_?icrs$',
    r'^dej2000$', r'^de_?j2000$', r'^delta$', r'^dec_?ep$',
    r'^_?dec$', r'^dec_?.*deg.*$'
]

DISTANCE_PATTERNS = [
    r'^dist.*$', r'^distance.*$', r'^sy_?dist$', r'^plx$', r'^parallax$',
    r'^d_?pc$', r'^d_?kpc$', r'^dist_?pc$', r'^dist_?kpc$'
]

MAGNITUDE_PATTERNS = [
    r'^mag$', r'^magnitude$', r'^vmag$', r'^sy_?vmag$', r'^v_?mag$',
    r'^bmag$', r'^gmag$', r'^rmag$', r'^imag$', r'^kmag$',
    r'^app_?mag$', r'^abs_?mag$', r'^brightness$'
]

MASS_PATTERNS = [
    r'^mass$', r'^.*_?mass$', r'^pl_?mass.*$', r'^st_?mass.*$',
    r'^m_?jup$', r'^m_?earth$', r'^m_?sun$'
]

RADIUS_PATTERNS = [
    r'^radius$', r'^.*_?rad.*$', r'^pl_?rad.*$', r'^st_?rad.*$',
    r'^r_?jup$', r'^r_?earth$', r'^r_?sun$'
]

TIME_PATTERNS = [
    r'^time$', r'^date$', r'^year$', r'^epoch$', r'^mjd$', r'^jd$',
    r'^obs_?date$', r'^disc_?year$', r'^discovery_?year$',
    r'^release_?date$', r'^pub_?date$'
]

NAME_PATTERNS = [
    r'^name$', r'^id$', r'^object_?id$', r'^pl_?name$', r'^hostname$',
    r'^star_?name$', r'^target$', r'^source_?id$', r'^designation$'
]


def find_column(df: pd.DataFrame, patterns: List[str]) -> Optional[str]:
    """Find a column matching any of the given regex patterns."""
    for col in df.columns:
        col_lower = col.lower().strip()
        for pattern in patterns:
            if re.match(pattern, col_lower):
                return col
    return None


def find_ra_column(df: pd.DataFrame) -> Optional[str]:
    """Detect RA column."""
    return find_column(df, RA_PATTERNS)


def find_dec_column(df: pd.DataFrame) -> Optional[str]:
    """Detect Dec column."""
    return find_column(df, DEC_PATTERNS)


def find_distance_column(df: pd.DataFrame) -> Optional[str]:
    """Detect distance column."""
    return find_column(df, DISTANCE_PATTERNS)


def find_magnitude_column(df: pd.DataFrame) -> Optional[str]:
    """Detect magnitude/brightness column."""
    return find_column(df, MAGNITUDE_PATTERNS)


def find_mass_column(df: pd.DataFrame) -> Optional[str]:
    """Detect mass column."""
    return find_column(df, MASS_PATTERNS)


def find_radius_column(df: pd.DataFrame) -> Optional[str]:
    """Detect radius column."""
    return find_column(df, RADIUS_PATTERNS)


def find_time_column(df: pd.DataFrame) -> Optional[str]:
    """Detect time/date column."""
    return find_column(df, TIME_PATTERNS)


def find_name_column(df: pd.DataFrame) -> Optional[str]:
    """Detect object name/ID column."""
    return find_column(df, NAME_PATTERNS)


def find_numeric_columns(df: pd.DataFrame) -> List[str]:
    """Find all numeric columns in the dataframe."""
    return df.select_dtypes(include=[np.number]).columns.tolist()


# ============================================================================
# COORDINATE PARSING
# ============================================================================

def parse_sexagesimal(value: str) -> Optional[float]:
    """
    Parse sexagesimal coordinate (HH:MM:SS or DD:MM:SS) to decimal degrees.
    For RA: result is in degrees (hours * 15)
    For Dec: result is in degrees
    """
    if not isinstance(value, str):
        return None
    
    value = value.strip()
    
    # Try HH:MM:SS.ss or DD:MM:SS.ss format
    match = re.match(r'^([+-]?\d+)[:\s]+(\d+)[:\s]+(\d+\.?\d*)$', value)
    if match:
        d = float(match.group(1))
        m = float(match.group(2))
        s = float(match.group(3))
        sign = -1 if d < 0 or value.startswith('-') else 1
        return sign * (abs(d) + m / 60.0 + s / 3600.0)
    
    # Try HH MM SS.ss format (space-separated)
    match = re.match(r'^([+-]?\d+)\s+(\d+)\s+(\d+\.?\d*)$', value)
    if match:
        d = float(match.group(1))
        m = float(match.group(2))
        s = float(match.group(3))
        sign = -1 if d < 0 or value.startswith('-') else 1
        return sign * (abs(d) + m / 60.0 + s / 3600.0)
    
    return None


def convert_ra_to_degrees(values: pd.Series) -> pd.Series:
    """
    Convert RA values to degrees.
    Handles: decimal degrees, decimal hours, sexagesimal (HH:MM:SS).
    """
    result = pd.Series(index=values.index, dtype=float)
    
    for idx, val in values.items():
        if pd.isna(val):
            result[idx] = np.nan
            continue
        
        # Already numeric
        if isinstance(val, (int, float)):
            num_val = float(val)
            # If value > 24, assume it's already in degrees
            # If value <= 24, assume it's in hours and convert
            if num_val <= 24:
                result[idx] = num_val * 15.0  # hours to degrees
            else:
                result[idx] = num_val
            continue
        
        # String value - try to parse
        val_str = str(val).strip()
        
        # Try as float first
        try:
            num_val = float(val_str)
            if num_val <= 24:
                result[idx] = num_val * 15.0
            else:
                result[idx] = num_val
            continue
        except ValueError:
            pass
        
        # Try sexagesimal (hours)
        parsed = parse_sexagesimal(val_str)
        if parsed is not None:
            result[idx] = parsed * 15.0  # hours to degrees
            continue
        
        result[idx] = np.nan
    
    return result


def convert_dec_to_degrees(values: pd.Series) -> pd.Series:
    """
    Convert Dec values to degrees.
    Handles: decimal degrees, sexagesimal (DD:MM:SS).
    """
    result = pd.Series(index=values.index, dtype=float)
    
    for idx, val in values.items():
        if pd.isna(val):
            result[idx] = np.nan
            continue
        
        # Already numeric
        if isinstance(val, (int, float)):
            result[idx] = float(val)
            continue
        
        # String value - try to parse
        val_str = str(val).strip()
        
        # Try as float first
        try:
            result[idx] = float(val_str)
            continue
        except ValueError:
            pass
        
        # Try sexagesimal
        parsed = parse_sexagesimal(val_str)
        if parsed is not None:
            result[idx] = parsed
            continue
        
        result[idx] = np.nan
    
    return result


# ============================================================================
# DATA PREPROCESSING
# ============================================================================

def downsample_if_needed(df: pd.DataFrame, max_points: int = 10000) -> Tuple[pd.DataFrame, bool]:
    """
    Downsample dataframe if it exceeds max_points.
    Returns (dataframe, was_downsampled).
    """
    if len(df) <= max_points:
        return df, False
    
    # Random sample to preserve distribution
    sampled = df.sample(n=max_points, random_state=42)
    return sampled.reset_index(drop=True), True


def safe_numeric(series: pd.Series) -> pd.Series:
    """Convert series to numeric, coercing errors to NaN."""
    return pd.to_numeric(series, errors='coerce')


def get_column_unit(column_name: str, columns_meta: Optional[List[Dict[str, Any]]] = None) -> str:
    """Extract unit for a column from metadata if available."""
    if columns_meta:
        for col in columns_meta:
            if col.get('name') == column_name:
                unit = col.get('unit')
                if unit and unit not in ['none', 'unknown', '']:
                    return unit
    return ''


def format_axis_label(column_name: str, unit: str = '') -> str:
    """Format axis label with optional unit."""
    # Clean up column name
    label = column_name.replace('_', ' ').title()
    if unit:
        return f"{label} ({unit})"
    return label
