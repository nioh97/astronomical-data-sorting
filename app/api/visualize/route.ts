/**
 * Visualization API Route
 * 
 * Calls Python visualization pipeline to generate astronomical plots.
 * Accepts dataset JSON (with optional filters applied) and returns plot URLs.
 * 
 * POST /api/visualize
 * Body: { dataset: Dataset, options?: VisualizationOptions }
 * 
 * This route is READ-ONLY - it does not modify the repository state.
 */

import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import { writeFile, unlink, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { randomUUID } from "crypto"

// Types
interface DatasetColumn {
  name: string
  semanticType: string
  unit: string | null
  description?: string
}

interface Dataset {
  id: string
  name: string
  columns: DatasetColumn[]
  rows: Record<string, unknown>[]
  sourceFile?: string
  createdAt?: string
}

interface VisualizationOptions {
  skyMap?: boolean
  scatterPlots?: boolean
  timeSeries?: boolean
  interactive?: boolean
  maxPoints?: number
}

interface VisualizationRequest {
  dataset: Dataset
  options?: VisualizationOptions
}

interface PlotResult {
  type: string
  success: boolean
  static_path?: string | null
  interactive_path?: string | null
  message?: string
  metadata?: Record<string, unknown>
}

interface VisualizationResponse {
  datasetId: string
  datasetName: string
  success: boolean
  plots: {
    sky_map: PlotResult | null
    scatter_plots: PlotResult[]
    time_series: PlotResult | null
  }
  errors: string[]
  timing: Record<string, number>
}

// Paths
const PYTHON_SCRIPT = path.join(
  process.cwd(),
  "lib",
  "python-visualization",
  "run_visualization.py"
)
const OUTPUT_DIR = path.join(process.cwd(), "public", "visualizations")

/**
 * Ensure output directory exists
 */
async function ensureOutputDir(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true })
  }
}

/**
 * Run Python visualization script
 */
async function runPythonVisualization(
  inputPath: string,
  outputDir: string
): Promise<VisualizationResponse> {
  return new Promise((resolve, reject) => {
    // Try python3 first, then python
    const pythonCmd = process.platform === "win32" ? "python" : "python3"
    
    const proc = spawn(pythonCmd, [PYTHON_SCRIPT, inputPath, outputDir], {
      cwd: path.dirname(PYTHON_SCRIPT),
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    proc.on("close", (code) => {
      // Try to parse stdout as JSON
      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch {
        // If parsing fails, check for errors
        if (code !== 0) {
          reject(new Error(`Python script failed (code ${code}): ${stderr || stdout}`))
        } else {
          reject(new Error(`Invalid JSON output: ${stdout.substring(0, 500)}`))
        }
      }
    })

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`))
    })

    // Timeout after 60 seconds
    setTimeout(() => {
      proc.kill()
      reject(new Error("Visualization timeout (60s exceeded)"))
    }, 60000)
  })
}

/**
 * POST /api/visualize
 * Generate visualizations for a dataset
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID().substring(0, 8)
  
  try {
    // Parse request body
    const body: VisualizationRequest = await request.json()
    
    if (!body.dataset) {
      return NextResponse.json(
        { success: false, error: "Missing dataset in request body" },
        { status: 400 }
      )
    }

    const { dataset, options = {} } = body

    // Validate dataset
    if (!dataset.rows || dataset.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Dataset has no rows" },
        { status: 400 }
      )
    }

    // Check if Python script exists
    if (!existsSync(PYTHON_SCRIPT)) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Python visualization script not found. Run: pip install -r lib/python-visualization/requirements.txt" 
        },
        { status: 500 }
      )
    }

    // Ensure output directory exists
    await ensureOutputDir()

    // Create dataset-specific output directory
    const datasetOutputDir = path.join(OUTPUT_DIR, dataset.id || requestId)
    if (!existsSync(datasetOutputDir)) {
      await mkdir(datasetOutputDir, { recursive: true })
    }

    // Write dataset to temp file
    const tempInputPath = path.join(datasetOutputDir, `input_${requestId}.json`)
    const inputData = {
      ...dataset,
      datasetId: dataset.id,
      options: {
        skyMap: options.skyMap ?? true,
        scatterPlots: options.scatterPlots ?? true,
        timeSeries: options.timeSeries ?? true,
        interactive: options.interactive ?? true,
        maxPoints: options.maxPoints ?? 10000,
      },
    }
    
    await writeFile(tempInputPath, JSON.stringify(inputData, null, 2), "utf-8")

    // Run Python visualization
    let result: VisualizationResponse
    try {
      result = await runPythonVisualization(tempInputPath, datasetOutputDir)
    } finally {
      // Clean up temp input file
      try {
        await unlink(tempInputPath)
      } catch {
        // Ignore cleanup errors
      }
    }

    // Return result
    return NextResponse.json(result)

  } catch (error) {
    console.error(`[visualize/${requestId}] Error:`, error)
    
    const message = error instanceof Error ? error.message : "Unknown error"
    
    return NextResponse.json(
      {
        success: false,
        error: message,
        plots: {
          sky_map: null,
          scatter_plots: [],
          time_series: null,
        },
        errors: [message],
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/visualize
 * Return API info
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: "Astronomical Visualization API",
    version: "1.0.0",
    description: "Generate sky maps, scatter plots, and time series from astronomical datasets",
    endpoints: {
      POST: {
        description: "Generate visualizations for a dataset",
        body: {
          dataset: "Dataset object with id, name, columns, rows",
          options: {
            skyMap: "boolean (default: true)",
            scatterPlots: "boolean (default: true)",
            timeSeries: "boolean (default: true)",
            interactive: "boolean (default: true) - generate Bokeh HTML",
            maxPoints: "number (default: 10000) - max points to plot",
          },
        },
      },
    },
    requirements: [
      "Python 3.8+",
      "astropy",
      "numpy",
      "pandas",
      "matplotlib",
      "bokeh",
    ],
  })
}
