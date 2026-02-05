#!/usr/bin/env python3
"""
Astronomical Visualization Pipeline

Main entry point for generating visualizations from dataset JSON.
Called by Next.js API route.

Usage:
    python run_visualization.py <input_json> <output_dir>
    
Input JSON format:
{
    "datasetId": "dataset_123",
    "name": "My Dataset",
    "columns": [
        {"name": "ra", "semanticType": "angle", "unit": "deg"},
        ...
    ],
    "rows": [
        {"ra": 123.45, "dec": -12.34, "vmag": 5.6},
        ...
    ],
    "options": {
        "skyMap": true,
        "scatterPlots": true,
        "timeSeries": true,
        "interactive": true,
        "maxPoints": 10000
    }
}

Output JSON format:
{
    "datasetId": "dataset_123",
    "success": true,
    "plots": {
        "sky_map": {...},
        "scatter_plots": [...],
        "time_series": {...}
    },
    "errors": [],
    "timing": {
        "total_ms": 1234,
        "sky_map_ms": 500,
        ...
    }
}
"""

import sys
import os
import json
import time
import traceback
import pandas as pd
from typing import Dict, Any, List, Optional

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sky_map import generate_sky_map
from scatter_plots import generate_scatter_plots
from time_series import generate_time_series
from utils import find_ra_column, find_dec_column, find_time_column


def load_dataset(input_path: str) -> Dict[str, Any]:
    """Load dataset from JSON file."""
    with open(input_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def dataset_to_dataframe(dataset: Dict[str, Any]) -> pd.DataFrame:
    """Convert dataset JSON to pandas DataFrame."""
    rows = dataset.get('rows', [])
    if not rows:
        return pd.DataFrame()
    
    # Handle list of dicts (normal case)
    if isinstance(rows[0], dict):
        return pd.DataFrame(rows)
    
    # Handle list of lists with column headers
    columns = dataset.get('columns', [])
    if columns and isinstance(rows[0], list):
        col_names = [c.get('name', f'col_{i}') for i, c in enumerate(columns)]
        return pd.DataFrame(rows, columns=col_names)
    
    return pd.DataFrame(rows)


def run_visualization_pipeline(
    dataset: Dict[str, Any],
    output_dir: str,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Run the full visualization pipeline on a dataset.
    
    Args:
        dataset: Dataset dict with columns, rows, and metadata
        output_dir: Directory to save generated plots
        options: Visualization options
        
    Returns:
        Result dict with paths to generated plots
    """
    start_time = time.time()
    
    result = {
        'datasetId': dataset.get('id', dataset.get('datasetId', 'unknown')),
        'datasetName': dataset.get('name', 'Unknown Dataset'),
        'success': False,
        'plots': {
            'sky_map': None,
            'scatter_plots': [],
            'time_series': None
        },
        'errors': [],
        'timing': {}
    }
    
    # Parse options
    if options is None:
        options = dataset.get('options', {})
    
    generate_sky_map_opt = options.get('skyMap', True)
    generate_scatter_opt = options.get('scatterPlots', True)
    generate_time_series_opt = options.get('timeSeries', True)
    interactive = options.get('interactive', True)
    max_points = options.get('maxPoints', 10000)
    
    # Convert to DataFrame
    try:
        df = dataset_to_dataframe(dataset)
    except Exception as e:
        result['errors'].append(f'Failed to convert dataset to DataFrame: {str(e)}')
        return result
    
    if len(df) == 0:
        result['errors'].append('Dataset has no rows')
        return result
    
    # Get column metadata
    columns_meta = dataset.get('columns', [])
    
    dataset_id = result['datasetId']
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # ==================== SKY MAP ====================
    if generate_sky_map_opt:
        sky_map_start = time.time()
        try:
            # Check if RA/Dec columns exist
            ra_col = find_ra_column(df)
            dec_col = find_dec_column(df)
            
            if ra_col and dec_col:
                sky_map_result = generate_sky_map(
                    df=df,
                    output_dir=output_dir,
                    dataset_id=dataset_id,
                    columns_meta=columns_meta,
                    max_points=max_points,
                    interactive=interactive
                )
                result['plots']['sky_map'] = sky_map_result
                
                if not sky_map_result.get('success'):
                    result['errors'].append(f"Sky map: {sky_map_result.get('message', 'Unknown error')}")
            else:
                result['plots']['sky_map'] = {
                    'type': 'sky_map',
                    'success': False,
                    'message': 'No RA/Dec columns found in dataset'
                }
        except Exception as e:
            result['errors'].append(f'Sky map error: {str(e)}')
            result['plots']['sky_map'] = {
                'type': 'sky_map',
                'success': False,
                'message': str(e)
            }
        
        result['timing']['sky_map_ms'] = int((time.time() - sky_map_start) * 1000)
    
    # ==================== SCATTER PLOTS ====================
    if generate_scatter_opt:
        scatter_start = time.time()
        try:
            scatter_result = generate_scatter_plots(
                df=df,
                output_dir=output_dir,
                dataset_id=dataset_id,
                columns_meta=columns_meta,
                max_points=max_points,
                interactive=interactive
            )
            
            if scatter_result.get('success'):
                result['plots']['scatter_plots'] = scatter_result.get('plots', [])
            else:
                result['errors'].append(f"Scatter plots: {scatter_result.get('message', 'Unknown error')}")
                
        except Exception as e:
            result['errors'].append(f'Scatter plots error: {str(e)}')
        
        result['timing']['scatter_plots_ms'] = int((time.time() - scatter_start) * 1000)
    
    # ==================== TIME SERIES ====================
    if generate_time_series_opt:
        ts_start = time.time()
        try:
            # Check if time column exists
            time_col = find_time_column(df)
            
            if time_col:
                ts_result = generate_time_series(
                    df=df,
                    output_dir=output_dir,
                    dataset_id=dataset_id,
                    columns_meta=columns_meta,
                    max_points=max_points,
                    interactive=interactive
                )
                result['plots']['time_series'] = ts_result
                
                if not ts_result.get('success'):
                    result['errors'].append(f"Time series: {ts_result.get('message', 'Unknown error')}")
            else:
                result['plots']['time_series'] = {
                    'type': 'time_series',
                    'success': False,
                    'message': 'No time/date column found in dataset'
                }
        except Exception as e:
            result['errors'].append(f'Time series error: {str(e)}')
            result['plots']['time_series'] = {
                'type': 'time_series',
                'success': False,
                'message': str(e)
            }
        
        result['timing']['time_series_ms'] = int((time.time() - ts_start) * 1000)
    
    # Calculate total time
    result['timing']['total_ms'] = int((time.time() - start_time) * 1000)
    
    # Determine overall success
    has_any_plot = (
        (result['plots']['sky_map'] and result['plots']['sky_map'].get('success')) or
        len(result['plots']['scatter_plots']) > 0 or
        (result['plots']['time_series'] and result['plots']['time_series'].get('success'))
    )
    
    result['success'] = has_any_plot
    
    if not result['success'] and not result['errors']:
        result['errors'].append('No visualizations could be generated from this dataset')
    
    return result


def convert_paths_to_relative(result: Dict[str, Any], base_dir: str) -> Dict[str, Any]:
    """Convert absolute paths in result to relative paths for web serving."""
    def convert_path(path: Optional[str]) -> Optional[str]:
        if path is None:
            return None
        # Convert to relative path from public directory
        if 'public' in path:
            idx = path.find('public')
            return '/' + path[idx + 7:].replace('\\', '/')
        return path.replace('\\', '/')
    
    # Convert sky map paths
    if result['plots']['sky_map']:
        sm = result['plots']['sky_map']
        sm['static_path'] = convert_path(sm.get('static_path'))
        sm['interactive_path'] = convert_path(sm.get('interactive_path'))
    
    # Convert scatter plot paths
    for sp in result['plots'].get('scatter_plots', []):
        sp['static_path'] = convert_path(sp.get('static_path'))
        sp['interactive_path'] = convert_path(sp.get('interactive_path'))
    
    # Convert time series paths
    if result['plots']['time_series']:
        ts = result['plots']['time_series']
        ts['static_path'] = convert_path(ts.get('static_path'))
        ts['interactive_path'] = convert_path(ts.get('interactive_path'))
    
    return result


def main():
    """Main entry point for command-line usage."""
    if len(sys.argv) < 3:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python run_visualization.py <input_json> <output_dir>'
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    try:
        # Load dataset
        dataset = load_dataset(input_path)
        
        # Run pipeline
        result = run_visualization_pipeline(dataset, output_dir)
        
        # Convert paths to relative for web serving
        result = convert_paths_to_relative(result, output_dir)
        
        # Output result as JSON
        print(json.dumps(result, indent=2, default=str))
        
        sys.exit(0 if result['success'] else 1)
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
