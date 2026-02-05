"""
Astronomy-Grade Sky Map Generator

Generates all-sky maps using Astropy coordinates and Matplotlib/Bokeh.
Supports Aitoff and Mollweide projections with color coding by magnitude/distance.
"""

import os
import json
import numpy as np
import pandas as pd
from typing import Optional, Dict, Any, Tuple, List

# Astropy imports
from astropy.coordinates import SkyCoord
import astropy.units as u

# Visualization imports
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server-side rendering
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from matplotlib import cm

# Try to import Bokeh for interactive plots
try:
    from bokeh.plotting import figure, save, output_file
    from bokeh.models import ColumnDataSource, HoverTool, ColorBar, LinearColorMapper
    from bokeh.palettes import Viridis256, Plasma256
    from bokeh.transform import linear_cmap
    BOKEH_AVAILABLE = True
except ImportError:
    BOKEH_AVAILABLE = False

from utils import (
    find_ra_column, find_dec_column, find_magnitude_column,
    find_distance_column, find_name_column,
    convert_ra_to_degrees, convert_dec_to_degrees,
    downsample_if_needed, safe_numeric, get_column_unit, format_axis_label
)


def generate_sky_map(
    df: pd.DataFrame,
    output_dir: str,
    dataset_id: str,
    columns_meta: Optional[List[Dict[str, Any]]] = None,
    projection: str = 'aitoff',
    color_by: Optional[str] = None,
    size_by: Optional[str] = None,
    max_points: int = 10000,
    interactive: bool = True
) -> Dict[str, Any]:
    """
    Generate an astronomical sky map from the dataset.
    
    Args:
        df: DataFrame with RA/Dec columns
        output_dir: Directory to save output files
        dataset_id: Unique identifier for the dataset
        columns_meta: Column metadata with units
        projection: 'aitoff' or 'mollweide'
        color_by: Column to use for color coding (auto-detect if None)
        size_by: Column to use for point sizing (auto-detect if None)
        max_points: Maximum points to plot (downsample if exceeded)
        interactive: Generate interactive Bokeh plot if available
        
    Returns:
        Dict with plot paths and metadata
    """
    result = {
        'type': 'sky_map',
        'success': False,
        'static_path': None,
        'interactive_path': None,
        'message': '',
        'metadata': {}
    }
    
    # Detect RA/Dec columns
    ra_col = find_ra_column(df)
    dec_col = find_dec_column(df)
    
    if not ra_col or not dec_col:
        result['message'] = 'No RA/Dec columns detected in dataset'
        return result
    
    # Convert coordinates to degrees
    try:
        ra_deg = convert_ra_to_degrees(df[ra_col])
        dec_deg = convert_dec_to_degrees(df[dec_col])
    except Exception as e:
        result['message'] = f'Failed to parse coordinates: {str(e)}'
        return result
    
    # Create working dataframe
    plot_df = pd.DataFrame({
        'ra_deg': ra_deg,
        'dec_deg': dec_deg
    })
    
    # Auto-detect color column if not specified
    if color_by is None:
        color_by = find_magnitude_column(df) or find_distance_column(df)
    
    if color_by and color_by in df.columns:
        plot_df['color_value'] = safe_numeric(df[color_by])
    else:
        plot_df['color_value'] = np.nan
        color_by = None
    
    # Auto-detect size column if not specified
    if size_by is None:
        if color_by and find_magnitude_column(df) == color_by:
            size_by = find_distance_column(df)
        else:
            size_by = find_magnitude_column(df)
    
    if size_by and size_by in df.columns:
        plot_df['size_value'] = safe_numeric(df[size_by])
    else:
        plot_df['size_value'] = np.nan
        size_by = None
    
    # Add name column for tooltips
    name_col = find_name_column(df)
    if name_col and name_col in df.columns:
        plot_df['name'] = df[name_col].astype(str)
    else:
        plot_df['name'] = [f'Object {i+1}' for i in range(len(df))]
    
    # Remove rows with invalid coordinates
    valid_mask = ~(plot_df['ra_deg'].isna() | plot_df['dec_deg'].isna())
    plot_df = plot_df[valid_mask].copy()
    
    if len(plot_df) == 0:
        result['message'] = 'No valid coordinates found in dataset'
        return result
    
    # Downsample if needed
    plot_df, was_downsampled = downsample_if_needed(plot_df, max_points)
    
    # Create Astropy SkyCoord for proper handling
    try:
        coords = SkyCoord(
            ra=plot_df['ra_deg'].values * u.deg,
            dec=plot_df['dec_deg'].values * u.deg,
            frame='icrs'
        )
        
        # Convert RA to range [-180, 180] for plotting (centered on 0)
        ra_plot = coords.ra.wrap_at(180 * u.deg).radian
        dec_plot = coords.dec.radian
        
        plot_df['ra_rad'] = ra_plot
        plot_df['dec_rad'] = dec_plot
        
    except Exception as e:
        result['message'] = f'Failed to create sky coordinates: {str(e)}'
        return result
    
    # Prepare output paths
    os.makedirs(output_dir, exist_ok=True)
    base_name = f'sky_map_{dataset_id}'
    static_path = os.path.join(output_dir, f'{base_name}.png')
    interactive_path = os.path.join(output_dir, f'{base_name}.html') if BOKEH_AVAILABLE and interactive else None
    
    # Generate static matplotlib plot
    try:
        _generate_matplotlib_sky_map(
            plot_df, static_path, projection, color_by, size_by, columns_meta
        )
        result['static_path'] = static_path
    except Exception as e:
        result['message'] = f'Failed to generate static plot: {str(e)}'
        # Continue to try interactive
    
    # Generate interactive Bokeh plot
    if BOKEH_AVAILABLE and interactive:
        try:
            _generate_bokeh_sky_map(
                plot_df, interactive_path, color_by, size_by, columns_meta
            )
            result['interactive_path'] = interactive_path
        except Exception as e:
            # Bokeh failed, but we may have static plot
            pass
    
    # Set success and metadata
    if result['static_path'] or result['interactive_path']:
        result['success'] = True
        result['message'] = 'Sky map generated successfully'
        result['metadata'] = {
            'total_points': len(plot_df),
            'was_downsampled': was_downsampled,
            'ra_column': ra_col,
            'dec_column': dec_col,
            'color_column': color_by,
            'size_column': size_by,
            'projection': projection,
            'ra_range': [float(plot_df['ra_deg'].min()), float(plot_df['ra_deg'].max())],
            'dec_range': [float(plot_df['dec_deg'].min()), float(plot_df['dec_deg'].max())]
        }
    
    return result


def _generate_matplotlib_sky_map(
    df: pd.DataFrame,
    output_path: str,
    projection: str,
    color_by: Optional[str],
    size_by: Optional[str],
    columns_meta: Optional[List[Dict[str, Any]]]
):
    """Generate static sky map using Matplotlib."""
    
    fig = plt.figure(figsize=(14, 8))
    ax = fig.add_subplot(111, projection=projection)
    
    # Prepare colors
    if color_by and 'color_value' in df.columns and not df['color_value'].isna().all():
        color_vals = df['color_value'].fillna(df['color_value'].median())
        # Invert for magnitude (brighter = lower magnitude)
        if 'mag' in color_by.lower():
            color_vals = -color_vals  # Invert so brighter objects are brighter colors
        norm = Normalize(vmin=color_vals.min(), vmax=color_vals.max())
        colors = cm.viridis(norm(color_vals))
    else:
        colors = 'dodgerblue'
    
    # Prepare sizes
    if size_by and 'size_value' in df.columns and not df['size_value'].isna().all():
        size_vals = df['size_value'].fillna(df['size_value'].median())
        # Normalize sizes between 5 and 50
        size_norm = (size_vals - size_vals.min()) / (size_vals.max() - size_vals.min() + 1e-10)
        sizes = 5 + 45 * (1 - size_norm)  # Invert so smaller values = larger points
    else:
        sizes = 15
    
    # Plot points
    scatter = ax.scatter(
        df['ra_rad'], 
        df['dec_rad'],
        c=colors if isinstance(colors, np.ndarray) else None,
        s=sizes,
        alpha=0.7,
        edgecolors='white',
        linewidths=0.3,
        color=colors if isinstance(colors, str) else None
    )
    
    # Add colorbar if color coding
    if color_by and isinstance(colors, np.ndarray):
        unit = get_column_unit(color_by, columns_meta)
        label = format_axis_label(color_by, unit)
        cbar = fig.colorbar(scatter, ax=ax, orientation='horizontal', 
                           pad=0.08, shrink=0.6, aspect=40)
        cbar.set_label(label, fontsize=10)
    
    # Styling
    ax.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
    ax.set_facecolor('#0a0a1a')
    fig.patch.set_facecolor('#0a0a1a')
    
    # Labels
    ax.set_xlabel('Right Ascension', fontsize=11, color='white')
    ax.set_ylabel('Declination', fontsize=11, color='white')
    ax.tick_params(colors='white', labelsize=9)
    
    title = f'All-Sky Map ({projection.capitalize()} Projection)'
    if color_by:
        title += f' — Color: {color_by}'
    ax.set_title(title, fontsize=13, color='white', pad=15)
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, facecolor='#0a0a1a', edgecolor='none', 
                bbox_inches='tight', pad_inches=0.2)
    plt.close(fig)


def _generate_bokeh_sky_map(
    df: pd.DataFrame,
    output_path: str,
    color_by: Optional[str],
    size_by: Optional[str],
    columns_meta: Optional[List[Dict[str, Any]]]
):
    """Generate interactive sky map using Bokeh."""
    
    if not BOKEH_AVAILABLE:
        return
    
    # Convert radians to degrees for Bokeh (easier to understand in tooltips)
    source_data = {
        'ra_deg': df['ra_deg'].values,
        'dec_deg': df['dec_deg'].values,
        'ra_plot': np.degrees(df['ra_rad'].values),  # Back to degrees for plotting
        'dec_plot': np.degrees(df['dec_rad'].values),
        'name': df['name'].values
    }
    
    # Prepare colors
    if color_by and 'color_value' in df.columns and not df['color_value'].isna().all():
        source_data['color_value'] = df['color_value'].fillna(df['color_value'].median()).values
    else:
        source_data['color_value'] = np.zeros(len(df))
    
    # Prepare sizes
    if size_by and 'size_value' in df.columns and not df['size_value'].isna().all():
        size_vals = df['size_value'].fillna(df['size_value'].median())
        size_norm = (size_vals - size_vals.min()) / (size_vals.max() - size_vals.min() + 1e-10)
        source_data['size'] = (5 + 15 * (1 - size_norm)).values
    else:
        source_data['size'] = np.full(len(df), 8)
    
    source = ColumnDataSource(source_data)
    
    # Create figure
    p = figure(
        width=1000, height=500,
        title=f'Interactive Sky Map — {len(df)} objects',
        x_axis_label='Right Ascension (°)',
        y_axis_label='Declination (°)',
        tools='pan,wheel_zoom,box_zoom,reset,save',
        x_range=(-180, 180),
        y_range=(-90, 90),
        background_fill_color='#0a0a1a'
    )
    
    # Color mapper
    if color_by and 'color_value' in df.columns and not df['color_value'].isna().all():
        color_vals = source_data['color_value']
        mapper = linear_cmap(
            field_name='color_value',
            palette=Viridis256,
            low=float(np.nanmin(color_vals)),
            high=float(np.nanmax(color_vals))
        )
        circle_color = mapper
    else:
        circle_color = 'dodgerblue'
    
    # Plot points
    circles = p.circle(
        'ra_plot', 'dec_plot',
        source=source,
        size='size',
        color=circle_color,
        alpha=0.7,
        line_color='white',
        line_width=0.3
    )
    
    # Add hover tool
    tooltips = [
        ('Name', '@name'),
        ('RA', '@ra_deg{0.000}°'),
        ('Dec', '@dec_deg{0.000}°'),
    ]
    if color_by:
        tooltips.append((color_by, '@color_value{0.00}'))
    
    hover = HoverTool(tooltips=tooltips, renderers=[circles])
    p.add_tools(hover)
    
    # Add color bar if color coding
    if color_by and isinstance(circle_color, dict):
        unit = get_column_unit(color_by, columns_meta)
        label = format_axis_label(color_by, unit)
        color_bar = ColorBar(
            color_mapper=LinearColorMapper(
                palette=Viridis256,
                low=float(np.nanmin(color_vals)),
                high=float(np.nanmax(color_vals))
            ),
            title=label,
            location=(0, 0),
            orientation='horizontal'
        )
        p.add_layout(color_bar, 'below')
    
    # Styling
    p.title.text_color = 'white'
    p.xaxis.axis_label_text_color = 'white'
    p.yaxis.axis_label_text_color = 'white'
    p.xaxis.major_tick_line_color = 'white'
    p.yaxis.major_tick_line_color = 'white'
    p.xaxis.major_label_text_color = 'white'
    p.yaxis.major_label_text_color = 'white'
    p.border_fill_color = '#0a0a1a'
    p.outline_line_color = '#333'
    p.grid.grid_line_alpha = 0.3
    p.grid.grid_line_color = 'white'
    
    # Save
    output_file(output_path, title='Sky Map')
    save(p)


if __name__ == '__main__':
    # Test with sample data
    import sys
    
    test_data = {
        'name': ['Sirius', 'Vega', 'Polaris', 'Betelgeuse', 'Rigel'],
        'ra': [101.29, 279.23, 37.95, 88.79, 78.63],
        'dec': [-16.72, 38.78, 89.26, 7.41, -8.20],
        'vmag': [-1.46, 0.03, 1.98, 0.42, 0.13],
        'distance_pc': [2.64, 7.68, 132, 222, 265]
    }
    
    df = pd.DataFrame(test_data)
    result = generate_sky_map(df, './test_output', 'test_dataset')
    print(json.dumps(result, indent=2))
