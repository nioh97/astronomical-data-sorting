"use client"

/**
 * Visualization Panel Component
 * 
 * Displays Python-generated astronomical visualizations for a dataset.
 * - Sky maps (Aitoff/Mollweide projection)
 * - Scatter plots (Distance vs Magnitude, etc.)
 * - Time series (when applicable)
 * 
 * Respects active filters and regenerates when filters change.
 */

import { useState, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Map,
  ScatterChart,
  LineChart,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react"
import type { Dataset } from "@/lib/data-context"
import { useFilterContext } from "@/lib/filters/filter-context"

// ============================================================================
// TYPES
// ============================================================================

interface PlotResult {
  type: string
  success: boolean
  static_path?: string | null
  interactive_path?: string | null
  message?: string
  metadata?: Record<string, unknown>
  x_column?: string
  y_column?: string
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

interface VisualizationPanelProps {
  dataset: Dataset
}

// ============================================================================
// PLOT DISPLAY COMPONENT
// ============================================================================

interface PlotDisplayProps {
  plot: PlotResult
  title: string
  icon: React.ReactNode
}

function PlotDisplay({ plot, title, icon }: PlotDisplayProps) {
  const [showInteractive, setShowInteractive] = useState(true)
  const [imageError, setImageError] = useState(false)

  if (!plot.success) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 text-slate-500 mb-2">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <p className="text-sm text-slate-400">{plot.message || "Not available"}</p>
      </div>
    )
  }

  const hasInteractive = !!plot.interactive_path
  const hasStatic = !!plot.static_path

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-slate-900">{title}</span>
          {plot.metadata?.total_points && (
            <Badge variant="secondary" className="text-xs">
              {(plot.metadata.total_points as number).toLocaleString()} points
            </Badge>
          )}
          {plot.metadata?.was_downsampled && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              Downsampled
            </Badge>
          )}
        </div>
        
        {hasInteractive && hasStatic && (
          <div className="flex items-center gap-1">
            <Button
              variant={showInteractive ? "default" : "outline"}
              size="sm"
              onClick={() => setShowInteractive(true)}
              className="h-7 text-xs"
            >
              Interactive
            </Button>
            <Button
              variant={!showInteractive ? "default" : "outline"}
              size="sm"
              onClick={() => setShowInteractive(false)}
              className="h-7 text-xs"
            >
              Static
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2">
        {showInteractive && hasInteractive ? (
          <iframe
            src={plot.interactive_path!}
            className="w-full h-[500px] border-0 rounded"
            title={title}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : hasStatic ? (
          imageError ? (
            <div className="flex items-center justify-center h-[400px] bg-slate-50 rounded">
              <div className="text-center text-slate-400">
                <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                <p>Failed to load image</p>
              </div>
            </div>
          ) : (
            <img
              src={plot.static_path!}
              alt={title}
              className="w-full max-h-[500px] object-contain rounded"
              onError={() => setImageError(true)}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-[400px] bg-slate-50 rounded">
            <p className="text-slate-400">No visualization available</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      {plot.metadata && Object.keys(plot.metadata).length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-slate-500">
              Show details
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-3 bg-slate-50 text-xs font-mono text-slate-600 max-h-40 overflow-auto">
              <pre>{JSON.stringify(plot.metadata, null, 2)}</pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VisualizationPanel({ dataset }: VisualizationPanelProps) {
  const { getFilterResult } = useFilterContext()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<VisualizationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFilterHash, setLastFilterHash] = useState<string>("")

  // Get filtered rows
  const filterResult = useMemo(
    () => getFilterResult(dataset),
    [getFilterResult, dataset]
  )

  const filteredRows = useMemo(() => {
    return filterResult.passingIndices.map((i) => dataset.rows[i])
  }, [filterResult, dataset.rows])

  // Create a hash of the current filter state to detect changes
  const currentFilterHash = useMemo(() => {
    return `${filterResult.filteredRows}_${filterResult.totalRows}`
  }, [filterResult])

  // Generate visualizations
  const generateVisualizations = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/visualize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataset: {
            id: dataset.id,
            name: dataset.name,
            columns: dataset.columns,
            rows: filteredRows,
            sourceFile: dataset.sourceFile,
          },
          options: {
            skyMap: true,
            scatterPlots: true,
            timeSeries: true,
            interactive: true,
            maxPoints: 10000,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data: VisualizationResponse = await response.json()
      setResult(data)
      setLastFilterHash(currentFilterHash)

      if (!data.success && data.errors.length > 0) {
        setError(data.errors.join("; "))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate visualizations"
      setError(message)
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }, [dataset, filteredRows, currentFilterHash])

  // Check if filters changed since last generation
  const filtersChanged = result && lastFilterHash !== currentFilterHash

  // Count successful plots
  const successfulPlotCount = useMemo(() => {
    if (!result) return 0
    let count = 0
    if (result.plots.sky_map?.success) count++
    count += result.plots.scatter_plots.filter((p) => p.success).length
    if (result.plots.time_series?.success) count++
    return count
  }, [result])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 h-auto border-t border-slate-100"
        >
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-slate-700">Advanced Visualizations</span>
            {result && result.success && (
              <Badge variant="secondary" className="text-xs">
                {successfulPlotCount} plot{successfulPlotCount !== 1 ? "s" : ""}
              </Badge>
            )}
            {filtersChanged && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                Filters changed
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-4 border-t border-slate-100 space-y-4">
          {/* Description */}
          <p className="text-sm text-slate-600">
            Generate astronomy-grade visualizations powered by Python (Astropy, Matplotlib, Bokeh).
            {filterResult.filteredRows < filterResult.totalRows && (
              <span className="text-blue-600 ml-1">
                Showing {filterResult.filteredRows.toLocaleString()} filtered rows.
              </span>
            )}
          </p>

          {/* Generate button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={generateVisualizations}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : result ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </>
              ) : (
                <>
                  <Map className="w-4 h-4" />
                  Generate Visualizations
                </>
              )}
            </Button>

            {result && result.timing?.total_ms && (
              <span className="text-xs text-slate-400">
                Generated in {(result.timing.total_ms / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Visualization Error</p>
                <p className="text-red-600">{error}</p>
                <p className="text-xs text-red-500 mt-1">
                  Ensure Python dependencies are installed: pip install -r lib/python-visualization/requirements.txt
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && result.success && (
            <div className="space-y-4">
              {/* Sky Map */}
              {result.plots.sky_map && (
                <PlotDisplay
                  plot={result.plots.sky_map}
                  title="Sky Map (RA/Dec)"
                  icon={<Map className="w-4 h-4 text-blue-500" />}
                />
              )}

              {/* Scatter Plots */}
              {result.plots.scatter_plots.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <ScatterChart className="w-4 h-4 text-green-500" />
                    Scatter Plots
                  </h4>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {result.plots.scatter_plots.map((plot, index) => (
                      <PlotDisplay
                        key={`scatter_${index}`}
                        plot={plot}
                        title={
                          plot.y_column && plot.x_column
                            ? `${plot.y_column} vs ${plot.x_column}`
                            : `Scatter Plot ${index + 1}`
                        }
                        icon={<ScatterChart className="w-4 h-4 text-green-500" />}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Time Series */}
              {result.plots.time_series && (
                <PlotDisplay
                  plot={result.plots.time_series}
                  title="Time Series"
                  icon={<LineChart className="w-4 h-4 text-purple-500" />}
                />
              )}

              {/* No visualizations warning */}
              {successfulPlotCount === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p>No visualizations could be generated from this dataset.</p>
                  <p className="text-sm text-slate-400 mt-1">
                    The dataset may be missing RA/Dec, time, or numeric columns.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                <p className="text-slate-600">Generating visualizations...</p>
                <p className="text-sm text-slate-400 mt-1">
                  This may take a few seconds for large datasets
                </p>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default VisualizationPanel
