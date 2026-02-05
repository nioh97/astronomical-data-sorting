"""
Time Series Plot Generator

Generates time series visualizations for astronomical data:
- Observation timestamps
- Discovery years
- Julian Date measurements
- Light curves

Supports interactive zoom/pan and handles missing data gracefully.
"""

import os
import json
import re
import numpy as np
import pandas as pd
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

# Visualization imports
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

# Try to import Bokeh
try:
    from bokeh.plotting import figure, save, output_file
    from bokeh.models import ColumnDataSource, HoverTool, DatetimeTickFormatter
    BOKEH_AVAILABLE = True
except ImportError:
    BOKEH_AVAILABLE = False

from utils import (
    find_time_column, find_name_column, find_numeric_columns,
    find_magnitude_column, find_distance_column,
    downsample_if_needed, safe_numeric, get_column_unit, format_axis_label
)


# Time-related column patterns
JD_PATTERNS = [r'^jd$', r'^julian_?date$', r'^hjd$', r'^bjd$']
MJD_PATTERNS = [r'^mjd$', r'^modified_?jd$']
YEAR_PATTERNS = [r'^year$', r'^disc_?year$', r'^discovery_?year$', r'^pub_?year$']
DATE_PATTERNS = [r'^date$', r'^obs_?date$', r'^release_?date$', r'^pub_?date$']


def detect_time_type(column_name: str, sample_values: pd.Series) -> Optional[str]:
    """
    Detect the type of time column.
    Returns: 'jd', 'mjd', 'year', 'date', 'numeric_time', or None
    """
    col_lower = column_name.lower().strip()
    
    # Check against known patterns
    for pattern in JD_PATTERNS:
        if re.match(pattern, col_lower):
            return 'jd'
    
    for pattern in MJD_PATTERNS:
        if re.match(pattern, col_lower):
            return 'mjd'
    
    for pattern in YEAR_PATTERNS:
        if re.match(pattern, col_lower):
            return 'year'
    
    for pattern in DATE_PATTERNS:
        if re.match(pattern, col_lower):
            return 'date'
    
    # Try to infer from values
    sample = sample_values.dropna().head(10)
    if len(sample) == 0:
        return None
    
    # Check if values look like years (1900-2100)
    numeric_sample = pd.to_numeric(sample, errors='coerce').dropna()
    if len(numeric_sample) > 0:
        if (numeric_sample >= 1900).all() and (numeric_sample <= 2100).all():
            return 'year'
        # JD values are typically > 2400000
        if (numeric_sample > 2400000).all():
            return 'jd'
        # MJD values are typically between 40000 and 70000
        if (numeric_sample > 40000).all() and (numeric_sample < 80000).all():
            return 'mjd'
    
    # Check if values are date strings
    try:
        pd.to_datetime(sample.head(3))
        return 'date'
    except:
        pass
    
    return None


def convert_to_datetime(
    series: pd.Series,
    time_type: str
) -> Tuple[pd.Series, str]:
    """
    Convert time values to datetime for plotting.
    Returns (datetime_series, display_label).
    """
    if time_type == 'year':
        # Year values - convert to datetime (Jan 1 of that year)
        numeric = safe_numeric(series)
        dates = pd.to_datetime(numeric, format='%Y', errors='coerce')
        return dates, 'Year'
    
    elif time_type == 'jd':
        # Julian Date - convert to datetime
        # JD 2451545.0 = 2000-01-01 12:00:00 TT
        numeric = safe_numeric(series)
        # Approximate conversion (ignoring leap seconds)
        dates = pd.to_datetime((numeric - 2440587.5) * 86400, unit='s', errors='coerce')
        return dates, 'Date (from JD)'
    
    elif time_type == 'mjd':
        # Modified Julian Date - convert to datetime
        # MJD 0 = 1858-11-17
        numeric = safe_numeric(series)
        dates = pd.to_datetime((numeric + 2400000.5 - 2440587.5) * 86400, unit='s', errors='coerce')
        return dates, 'Date (from MJD)'
    
    elif time_type == 'date':
        # Already date strings
        dates = pd.to_datetime(series, errors='coerce')
        return dates, 'Date'
    
    else:
        # Generic numeric time - just use as-is with index
        numeric = safe_numeric(series)
        # Create fake dates based on index position
        base_date = pd.Timestamp('2000-01-01')
        dates = base_date + pd.to_timedelta(numeric, unit='D')
        return dates, 'Time'


def generate_time_series(
    df: pd.DataFrame,
    output_dir: str,
    dataset_id: str,
    columns_meta: Optional[List[Dict[str, Any]]] = None,
    time_column: Optional[str] = None,
    value_column: Optional[str] = None,
    max_points: int = 10000,
    interactive: bool = True
) -> Dict[str, Any]:
    """
    Generate time series plots from the dataset.
    
    If time_column and value_column are not specified, auto-detects:
    - Time column: year, date, JD, MJD
    - Value column: magnitude, distance, or first numeric column
    
    Args:
        df: Input dataframe
        output_dir: Directory to save plots
        dataset_id: Unique identifier
        columns_meta: Column metadata with units
        time_column: Time/date column (auto-detect if None)
        value_column: Value column to plot (auto-detect if None)
        max_points: Maximum points to plot
        interactive: Generate Bokeh interactive plot
        
    Returns:
        Dict with plot paths and metadata
    """
    result = {
        'type': 'time_series',
        'success': False,
        'static_path': None,
        'interactive_path': None,
        'message': '',
        'metadata': {}
    }
    
    # Detect time column
    if time_column is None:
        time_column = find_time_column(df)
    
    if time_column is None or time_column not in df.columns:
        result['message'] = 'No time/date column detected in dataset'
        return result
    
    # Detect time type
    time_type = detect_time_type(time_column, df[time_column])
    if time_type is None:
        result['message'] = f'Could not determine time type for column: {time_column}'
        return result
    
    # Detect value column
    if value_column is None:
        value_column = find_magnitude_column(df) or find_distance_column(df)
        if value_column is None:
            # Use first numeric column that's not the time column
            numeric_cols = find_numeric_columns(df)
            for col in numeric_cols:
                if col != time_column:
                    value_column = col
                    break
    
    if value_column is None or value_column not in df.columns:
        result['message'] = 'No suitable value column for time series'
        return result
    
    # Convert time to datetime
    try:
        time_values, time_label = convert_to_datetime(df[time_column], time_type)
    except Exception as e:
        result['message'] = f'Failed to convert time values: {str(e)}'
        return result
    
    # Prepare data
    plot_df = pd.DataFrame({
        'time': time_values,
        'value': safe_numeric(df[value_column])
    })
    
    # Add names for tooltips
    name_col = find_name_column(df)
    if name_col and name_col in df.columns:
        plot_df['name'] = df[name_col].astype(str)
    else:
        plot_df['name'] = [f'Point {i+1}' for i in range(len(df))]
    
    # Store original time for display
    plot_df['time_original'] = df[time_column].astype(str)
    
    # Remove rows with invalid data
    valid_mask = ~(plot_df['time'].isna() | plot_df['value'].isna())
    plot_df = plot_df[valid_mask].copy()
    
    if len(plot_df) < 2:
        result['message'] = 'Not enough valid data points for time series'
        return result
    
    # Sort by time
    plot_df = plot_df.sort_values('time').reset_index(drop=True)
    
    # Downsample if needed
    plot_df, was_downsampled = downsample_if_needed(plot_df, max_points)
    
    # Get unit for value column
    value_unit = get_column_unit(value_column, columns_meta)
    value_label = format_axis_label(value_column, value_unit)
    
    # Check if value should be inverted (magnitude)
    invert_y = 'mag' in value_column.lower()
    
    # Generate file paths
    os.makedirs(output_dir, exist_ok=True)
    base_name = f'time_series_{dataset_id}'
    static_path = os.path.join(output_dir, f'{base_name}.png')
    interactive_path = os.path.join(output_dir, f'{base_name}.html') if BOKEH_AVAILABLE and interactive else None
    
    # Generate static plot
    try:
        _generate_matplotlib_time_series(
            plot_df, static_path, time_label, value_label, 
            value_column, invert_y
        )
        result['static_path'] = static_path
    except Exception as e:
        pass  # Continue to try interactive
    
    # Generate interactive plot
    if BOKEH_AVAILABLE and interactive:
        try:
            _generate_bokeh_time_series(
                plot_df, interactive_path, time_label, value_label,
                time_column, value_column, invert_y
            )
            result['interactive_path'] = interactive_path
        except Exception as e:
            pass
    
    if result['static_path'] or result['interactive_path']:
        result['success'] = True
        result['message'] = 'Time series generated successfully'
        result['metadata'] = {
            'total_points': len(plot_df),
            'was_downsampled': was_downsampled,
            'time_column': time_column,
            'time_type': time_type,
            'value_column': value_column,
            'time_range': [
                plot_df['time'].min().isoformat() if pd.notna(plot_df['time'].min()) else None,
                plot_df['time'].max().isoformat() if pd.notna(plot_df['time'].max()) else None
            ],
            'value_range': [float(plot_df['value'].min()), float(plot_df['value'].max())]
        }
    
    return result


def _generate_matplotlib_time_series(
    df: pd.DataFrame,
    output_path: str,
    time_label: str,
    value_label: str,
    value_column: str,
    invert_y: bool
):
    """Generate static time series plot with Matplotlib."""
    
    fig, ax = plt.subplots(figsize=(12, 6))
    
    # Plot line and points
    ax.plot(df['time'], df['value'], 'b-', alpha=0.5, linewidth=1)
    ax.scatter(df['time'], df['value'], c='#3b82f6', s=20, alpha=0.7, 
               edgecolors='white', linewidths=0.3, zorder=5)
    
    # Invert y-axis if needed (for magnitude)
    if invert_y:
        ax.invert_yaxis()
    
    # Format x-axis for dates
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y'))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    plt.xticks(rotation=45)
    
    # Labels
    ax.set_xlabel(time_label, fontsize=12)
    ax.set_ylabel(value_label, fontsize=12)
    ax.set_title(f'{value_column} over Time', fontsize=14)
    
    # Grid
    ax.grid(True, alpha=0.3, linestyle='--')
    
    # Styling
    ax.set_facecolor('#f8f9fa')
    fig.patch.set_facecolor('white')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)


def _generate_bokeh_time_series(
    df: pd.DataFrame,
    output_path: str,
    time_label: str,
    value_label: str,
    time_column: str,
    value_column: str,
    invert_y: bool
):
    """Generate interactive time series plot with Bokeh."""
    
    if not BOKEH_AVAILABLE:
        return
    
    # Convert datetime to milliseconds for Bokeh
    time_ms = df['time'].astype('int64') // 10**6
    
    source = ColumnDataSource({
        'time': df['time'].values,
        'time_ms': time_ms.values,
        'value': df['value'].values,
        'name': df['name'].values,
        'time_original': df['time_original'].values
    })
    
    # Calculate y_range with inversion if needed
    y_min, y_max = df['value'].min(), df['value'].max()
    y_pad = (y_max - y_min) * 0.05
    if invert_y:
        y_range = (y_max + y_pad, y_min - y_pad)
    else:
        y_range = (y_min - y_pad, y_max + y_pad)
    
    p = figure(
        width=900, height=450,
        title=f'{value_column} over Time — {len(df)} points',
        x_axis_label=time_label,
        y_axis_label=value_label,
        x_axis_type='datetime',
        y_range=y_range,
        tools='pan,wheel_zoom,box_zoom,reset,save'
    )
    
    # Plot line
    p.line('time', 'value', source=source, color='#3b82f6', alpha=0.5, line_width=1)
    
    # Plot points
    circles = p.circle(
        'time', 'value',
        source=source,
        size=6,
        color='#3b82f6',
        alpha=0.7,
        line_color='white',
        line_width=0.3
    )
    
    # Hover tool
    hover = HoverTool(
        tooltips=[
            ('Name', '@name'),
            (time_column, '@time_original'),
            (value_column, '@value{0.000}')
        ],
        renderers=[circles],
        formatters={'@time': 'datetime'}
    )
    p.add_tools(hover)
    
    # Date formatter
    p.xaxis.formatter = DatetimeTickFormatter(
        years='%Y',
        months='%b %Y',
        days='%d %b %Y'
    )
    
    # Grid styling
    p.grid.grid_line_alpha = 0.4
    p.grid.grid_line_dash = [4, 4]
    
    # Save
    output_file(output_path, title=f'{value_column} over Time')
    save(p)


def detect_light_curve(df: pd.DataFrame) -> bool:
    """
    Detect if the dataset looks like a light curve.
    Light curves typically have many observations of the same object
    with time and brightness measurements.
    """
    time_col = find_time_column(df)
    mag_col = find_magnitude_column(df)
    
    if not time_col or not mag_col:
        return False
    
    # Light curves typically have many points (>100)
    if len(df) < 100:
        return False
    
    # Check if there's variation in magnitude
    mag_values = safe_numeric(df[mag_col]).dropna()
    if len(mag_values) < 100:
        return False
    
    # Check for reasonable variation (not constant)
    mag_std = mag_values.std()
    if mag_std < 0.001:
        return False
    
    return True


if __name__ == '__main__':
    # Test with sample data
    test_data = {
        'name': ['Obs 1', 'Obs 2', 'Obs 3', 'Obs 4', 'Obs 5'],
        'discovery_year': [2010, 2012, 2015, 2018, 2022],
        'vmag': [12.5, 11.8, 13.2, 10.5, 14.0],
        'distance_pc': [100, 150, 80, 200, 120]
    }
    
    df = pd.DataFrame(test_data)
    result = generate_time_series(df, './test_output', 'test_dataset')
    print(json.dumps(result, indent=2, default=str))
