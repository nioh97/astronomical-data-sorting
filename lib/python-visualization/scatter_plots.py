"""
Scientific Scatter Plot Generator

Generates scatter plots for astronomical data:
- Distance vs Magnitude
- Radius vs Mass
- Any numeric column pair

Supports log scales, proper axis labeling with units, and interactive tooltips.
"""

import os
import json
import numpy as np
import pandas as pd
from typing import Optional, Dict, Any, List, Tuple

# Visualization imports
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize

# Try to import Bokeh
try:
    from bokeh.plotting import figure, save, output_file
    from bokeh.models import ColumnDataSource, HoverTool, LogAxis, Range1d
    from bokeh.palettes import Viridis256
    BOKEH_AVAILABLE = True
except ImportError:
    BOKEH_AVAILABLE = False

from utils import (
    find_distance_column, find_magnitude_column, find_mass_column,
    find_radius_column, find_name_column, find_numeric_columns,
    downsample_if_needed, safe_numeric, get_column_unit, format_axis_label
)


# Columns that should use log scale
LOG_SCALE_PATTERNS = [
    'mass', 'radius', 'distance', 'dist', 'period', 'luminosity',
    'flux', 'density', 'temp', 'temperature'
]

# Columns that should be inverted (e.g., magnitude - brighter = lower)
INVERT_PATTERNS = ['mag', 'magnitude', 'brightness']


def should_use_log_scale(column_name: str) -> bool:
    """Check if a column should use log scale."""
    col_lower = column_name.lower()
    return any(pattern in col_lower for pattern in LOG_SCALE_PATTERNS)


def should_invert_axis(column_name: str) -> bool:
    """Check if a column's axis should be inverted (e.g., magnitude)."""
    col_lower = column_name.lower()
    return any(pattern in col_lower for pattern in INVERT_PATTERNS)


def generate_scatter_plots(
    df: pd.DataFrame,
    output_dir: str,
    dataset_id: str,
    columns_meta: Optional[List[Dict[str, Any]]] = None,
    x_column: Optional[str] = None,
    y_column: Optional[str] = None,
    max_points: int = 10000,
    interactive: bool = True
) -> Dict[str, Any]:
    """
    Generate scientific scatter plots from the dataset.
    
    If x_column and y_column are not specified, auto-detects meaningful pairs:
    - Distance vs Magnitude
    - Radius vs Mass
    - First two numeric columns as fallback
    
    Args:
        df: Input dataframe
        output_dir: Directory to save plots
        dataset_id: Unique identifier
        columns_meta: Column metadata with units
        x_column: X-axis column (auto-detect if None)
        y_column: Y-axis column (auto-detect if None)
        max_points: Maximum points to plot
        interactive: Generate Bokeh interactive plot
        
    Returns:
        Dict with plot paths and metadata
    """
    result = {
        'type': 'scatter_plots',
        'success': False,
        'plots': [],
        'message': ''
    }
    
    # Get numeric columns
    numeric_cols = find_numeric_columns(df)
    
    if len(numeric_cols) < 2:
        result['message'] = 'Need at least 2 numeric columns for scatter plot'
        return result
    
    # Determine which plots to generate
    plot_configs = []
    
    if x_column and y_column:
        # User specified columns
        if x_column in df.columns and y_column in df.columns:
            plot_configs.append((x_column, y_column, 'custom'))
    else:
        # Auto-detect meaningful pairs
        dist_col = find_distance_column(df)
        mag_col = find_magnitude_column(df)
        mass_col = find_mass_column(df)
        radius_col = find_radius_column(df)
        
        # Distance vs Magnitude (classic astronomical diagram)
        if dist_col and mag_col:
            plot_configs.append((dist_col, mag_col, 'distance_magnitude'))
        
        # Radius vs Mass (planetary/stellar diagram)
        if radius_col and mass_col:
            plot_configs.append((radius_col, mass_col, 'radius_mass'))
        
        # If no specific pairs found, use first two numeric columns
        if not plot_configs and len(numeric_cols) >= 2:
            plot_configs.append((numeric_cols[0], numeric_cols[1], 'generic'))
    
    if not plot_configs:
        result['message'] = 'No suitable column pairs found for scatter plot'
        return result
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Find name column for tooltips
    name_col = find_name_column(df)
    
    for x_col, y_col, plot_type in plot_configs:
        plot_result = _generate_single_scatter(
            df, output_dir, dataset_id, x_col, y_col, plot_type,
            name_col, columns_meta, max_points, interactive
        )
        if plot_result['success']:
            result['plots'].append(plot_result)
    
    if result['plots']:
        result['success'] = True
        result['message'] = f'Generated {len(result["plots"])} scatter plot(s)'
    else:
        result['message'] = 'Failed to generate any scatter plots'
    
    return result


def _generate_single_scatter(
    df: pd.DataFrame,
    output_dir: str,
    dataset_id: str,
    x_col: str,
    y_col: str,
    plot_type: str,
    name_col: Optional[str],
    columns_meta: Optional[List[Dict[str, Any]]],
    max_points: int,
    interactive: bool
) -> Dict[str, Any]:
    """Generate a single scatter plot."""
    
    result = {
        'type': plot_type,
        'success': False,
        'static_path': None,
        'interactive_path': None,
        'x_column': x_col,
        'y_column': y_col,
        'metadata': {}
    }
    
    # Prepare data
    plot_df = pd.DataFrame({
        'x': safe_numeric(df[x_col]),
        'y': safe_numeric(df[y_col])
    })
    
    # Add names
    if name_col and name_col in df.columns:
        plot_df['name'] = df[name_col].astype(str)
    else:
        plot_df['name'] = [f'Object {i+1}' for i in range(len(df))]
    
    # Remove rows with NaN
    valid_mask = ~(plot_df['x'].isna() | plot_df['y'].isna())
    plot_df = plot_df[valid_mask].copy()
    
    if len(plot_df) < 2:
        result['message'] = f'Not enough valid data points for {x_col} vs {y_col}'
        return result
    
    # Filter out non-positive values if using log scale
    x_log = should_use_log_scale(x_col)
    y_log = should_use_log_scale(y_col)
    
    if x_log:
        plot_df = plot_df[plot_df['x'] > 0]
    if y_log:
        plot_df = plot_df[plot_df['y'] > 0]
    
    if len(plot_df) < 2:
        result['message'] = f'Not enough positive values for log scale'
        return result
    
    # Downsample if needed
    plot_df, was_downsampled = downsample_if_needed(plot_df, max_points)
    
    # Get units for labels
    x_unit = get_column_unit(x_col, columns_meta)
    y_unit = get_column_unit(y_col, columns_meta)
    x_label = format_axis_label(x_col, x_unit)
    y_label = format_axis_label(y_col, y_unit)
    
    # Determine if axes should be inverted
    x_invert = should_invert_axis(x_col)
    y_invert = should_invert_axis(y_col)
    
    # Generate file paths
    base_name = f'scatter_{plot_type}_{dataset_id}'
    static_path = os.path.join(output_dir, f'{base_name}.png')
    interactive_path = os.path.join(output_dir, f'{base_name}.html') if BOKEH_AVAILABLE and interactive else None
    
    # Generate static plot
    try:
        _generate_matplotlib_scatter(
            plot_df, static_path, x_label, y_label,
            x_log, y_log, x_invert, y_invert, x_col, y_col
        )
        result['static_path'] = static_path
    except Exception as e:
        pass  # Continue to try interactive
    
    # Generate interactive plot
    if BOKEH_AVAILABLE and interactive:
        try:
            _generate_bokeh_scatter(
                plot_df, interactive_path, x_label, y_label,
                x_log, y_log, x_invert, y_invert, x_col, y_col
            )
            result['interactive_path'] = interactive_path
        except Exception as e:
            pass
    
    if result['static_path'] or result['interactive_path']:
        result['success'] = True
        result['metadata'] = {
            'total_points': len(plot_df),
            'was_downsampled': was_downsampled,
            'x_log_scale': x_log,
            'y_log_scale': y_log,
            'x_inverted': x_invert,
            'y_inverted': y_invert,
            'x_range': [float(plot_df['x'].min()), float(plot_df['x'].max())],
            'y_range': [float(plot_df['y'].min()), float(plot_df['y'].max())]
        }
    
    return result


def _generate_matplotlib_scatter(
    df: pd.DataFrame,
    output_path: str,
    x_label: str,
    y_label: str,
    x_log: bool,
    y_log: bool,
    x_invert: bool,
    y_invert: bool,
    x_col: str,
    y_col: str
):
    """Generate static scatter plot with Matplotlib."""
    
    fig, ax = plt.subplots(figsize=(10, 8))
    
    # Plot points with gradient color
    scatter = ax.scatter(
        df['x'], df['y'],
        c=np.arange(len(df)),
        cmap='viridis',
        s=30,
        alpha=0.7,
        edgecolors='white',
        linewidths=0.3
    )
    
    # Set scales
    if x_log:
        ax.set_xscale('log')
    if y_log:
        ax.set_yscale('log')
    
    # Invert axes if needed
    if x_invert:
        ax.invert_xaxis()
    if y_invert:
        ax.invert_yaxis()
    
    # Labels and title
    ax.set_xlabel(x_label, fontsize=12)
    ax.set_ylabel(y_label, fontsize=12)
    ax.set_title(f'{y_col} vs {x_col}', fontsize=14)
    
    # Grid
    ax.grid(True, alpha=0.3, linestyle='--')
    
    # Styling
    ax.set_facecolor('#f8f9fa')
    fig.patch.set_facecolor('white')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)


def _generate_bokeh_scatter(
    df: pd.DataFrame,
    output_path: str,
    x_label: str,
    y_label: str,
    x_log: bool,
    y_log: bool,
    x_invert: bool,
    y_invert: bool,
    x_col: str,
    y_col: str
):
    """Generate interactive scatter plot with Bokeh."""
    
    if not BOKEH_AVAILABLE:
        return
    
    source = ColumnDataSource({
        'x': df['x'].values,
        'y': df['y'].values,
        'name': df['name'].values
    })
    
    # Determine axis types
    x_axis_type = 'log' if x_log else 'linear'
    y_axis_type = 'log' if y_log else 'linear'
    
    # Calculate ranges (with inversion if needed)
    x_min, x_max = df['x'].min(), df['x'].max()
    y_min, y_max = df['y'].min(), df['y'].max()
    
    # Add padding
    if x_log:
        x_range = (x_min * 0.8, x_max * 1.2)
    else:
        x_pad = (x_max - x_min) * 0.05
        x_range = (x_min - x_pad, x_max + x_pad)
    
    if y_log:
        y_range = (y_min * 0.8, y_max * 1.2)
    else:
        y_pad = (y_max - y_min) * 0.05
        y_range = (y_min - y_pad, y_max + y_pad)
    
    # Invert if needed
    if x_invert:
        x_range = (x_range[1], x_range[0])
    if y_invert:
        y_range = (y_range[1], y_range[0])
    
    p = figure(
        width=800, height=600,
        title=f'{y_col} vs {x_col} — {len(df)} objects',
        x_axis_label=x_label,
        y_axis_label=y_label,
        x_axis_type=x_axis_type,
        y_axis_type=y_axis_type,
        x_range=x_range,
        y_range=y_range,
        tools='pan,wheel_zoom,box_zoom,reset,save'
    )
    
    # Plot points
    circles = p.circle(
        'x', 'y',
        source=source,
        size=8,
        color='#3b82f6',
        alpha=0.7,
        line_color='white',
        line_width=0.3
    )
    
    # Hover tool
    hover = HoverTool(
        tooltips=[
            ('Name', '@name'),
            (x_col, '@x{0.000}'),
            (y_col, '@y{0.000}')
        ],
        renderers=[circles]
    )
    p.add_tools(hover)
    
    # Grid styling
    p.grid.grid_line_alpha = 0.4
    p.grid.grid_line_dash = [4, 4]
    
    # Save
    output_file(output_path, title=f'{y_col} vs {x_col}')
    save(p)


def generate_all_numeric_pairs(
    df: pd.DataFrame,
    output_dir: str,
    dataset_id: str,
    columns_meta: Optional[List[Dict[str, Any]]] = None,
    max_pairs: int = 5,
    max_points: int = 5000
) -> Dict[str, Any]:
    """
    Generate scatter plots for all meaningful numeric column pairs.
    Limited to max_pairs to avoid generating too many plots.
    """
    result = {
        'type': 'all_numeric_pairs',
        'success': False,
        'plots': [],
        'message': ''
    }
    
    numeric_cols = find_numeric_columns(df)
    
    if len(numeric_cols) < 2:
        result['message'] = 'Need at least 2 numeric columns'
        return result
    
    # Generate pairs (limit to max_pairs)
    pairs = []
    for i, col1 in enumerate(numeric_cols):
        for col2 in numeric_cols[i+1:]:
            pairs.append((col1, col2))
            if len(pairs) >= max_pairs:
                break
        if len(pairs) >= max_pairs:
            break
    
    name_col = find_name_column(df)
    os.makedirs(output_dir, exist_ok=True)
    
    for x_col, y_col in pairs:
        plot_result = _generate_single_scatter(
            df, output_dir, dataset_id, x_col, y_col, f'{x_col}_{y_col}',
            name_col, columns_meta, max_points, interactive=True
        )
        if plot_result['success']:
            result['plots'].append(plot_result)
    
    if result['plots']:
        result['success'] = True
        result['message'] = f'Generated {len(result["plots"])} scatter plots'
    
    return result


if __name__ == '__main__':
    # Test with sample data
    test_data = {
        'name': ['Planet A', 'Planet B', 'Planet C', 'Planet D', 'Planet E'],
        'distance_pc': [10.5, 25.3, 100.2, 250.0, 500.0],
        'vmag': [5.2, 7.8, 10.1, 12.5, 15.0],
        'mass_earth': [1.0, 5.5, 15.0, 50.0, 300.0],
        'radius_earth': [1.0, 1.8, 3.5, 8.0, 11.0]
    }
    
    df = pd.DataFrame(test_data)
    result = generate_scatter_plots(df, './test_output', 'test_dataset')
    print(json.dumps(result, indent=2, default=str))
