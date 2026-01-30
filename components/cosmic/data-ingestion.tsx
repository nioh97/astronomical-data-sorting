"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { parseFile } from "@/lib/file-parsers"
import { useDataContext, Dataset } from "@/lib/data-context"
import { analyzeFieldsWithLLM, FieldAnalysisResult } from "@/lib/field-analysis"
import { convertDatasetWithLLM } from "@/lib/llm-conversion"
import { UnitSelectionDialog } from "./unit-selection-dialog"

interface IngestedDataset {
  name: string
  status: "pending" | "processing" | "completed" | "error"
  uploadedAt?: Date
}

export default function DataIngestionSection() {
  const { addDataset } = useDataContext()
  const [ingestedDatasets, setIngestedDatasets] = useState<IngestedDataset[]>([])
  const [uploading, setUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState<number>(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [unitDialogOpen, setUnitDialogOpen] = useState(false)
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    fieldAnalysis: FieldAnalysisResult[]
    parsedData: { headers: string[]; rows: Record<string, any>[]; metadata?: Record<string, any> }
    filename: string
    fileType: "csv" | "json" | "xml"
  } | null>(null)

  const handleDeleteDataset = (index: number) => {
    setIngestedDatasets((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUnitSelectionConfirm = async (selectedUnits: Record<string, string | null>) => {
    if (!pendingAnalysis) return

    setIsProcessing(true)
    setProcessingStep("Converting dataset with AI…")
    setProcessingProgress(60)

    try {
      const { fieldAnalysis, parsedData, filename, fileType } = pendingAnalysis

      // STAGE 2: Convert dataset using qwen-2.5-3b
      setProcessingStep("Converting units and values…")
      setProcessingProgress(70)
      const conversionResult = await convertDatasetWithLLM({
        filename,
        fileType,
        headers: parsedData.headers,
        rows: parsedData.rows, // Full dataset
        fieldAnalysis,
        selectedUnits,
      })

      // STAGE 3: Create Dataset Object
      setProcessingStep("Storing dataset…")
      setProcessingProgress(80)
      const dataset: Dataset = {
        id: `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: conversionResult.datasetName,
        columns: conversionResult.columns,
        rows: conversionResult.rows,
        sourceFile: filename,
        createdAt: new Date().toISOString(),
      }

      // STAGE 4: Add to repository
      setProcessingProgress(90)
      addDataset(dataset)

      // Create ingestion record
      const newDataset: IngestedDataset = {
        name: filename,
        status: "completed",
        uploadedAt: new Date(),
      }

      setIngestedDatasets([newDataset, ...ingestedDatasets])
      setProcessingProgress(100)
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)

      // Reset state
      setPendingAnalysis(null)
      setUnitDialogOpen(false)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to convert and store dataset")
      setProcessingProgress(0)
    } finally {
      setIsProcessing(false)
      setProcessingStep("")
      setTimeout(() => setProcessingProgress(0), 2000)
    }
  }

  const handleUnitSelectionCancel = () => {
    setPendingAnalysis(null)
    setUnitDialogOpen(false)
    setUploadError("Dataset ingestion cancelled by user")
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setIsProcessing(true)
    setUploadError(null)
    setUploadSuccess(false)
    setProcessingStep("")
    setProcessingProgress(0)

    try {
      // STAGE 1: Parse the file
      setProcessingStep("Parsing file…")
      setProcessingProgress(10)
      const parsedData = await parseFile(file)
      
      if (parsedData.rows.length === 0) {
        throw new Error("File contains no data rows")
      }

      // Extract sample rows for LLM (10-15 rows)
      const sampleRows = parsedData.rows.slice(0, 15)

      // Determine file type
      const fileExtension = file.name.split(".").pop()?.toLowerCase() || ""
      const fileType: "csv" | "json" | "xml" = 
        fileExtension === "csv" ? "csv" :
        fileExtension === "json" ? "json" :
        fileExtension === "xml" ? "xml" :
        "csv" // default

      // Read raw file text for LLM
      const rawText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          resolve(e.target?.result as string)
        }
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsText(file)
      })

      // STAGE 1: Field & Metadata Analysis (llama-3.1-8b ONLY)
      setProcessingStep("Analyzing fields with AI…")
      setProcessingProgress(30)
      const fieldAnalysisResult = await analyzeFieldsWithLLM({
        filename: file.name,
        fileType,
        headers: parsedData.headers,
        sampleRows: parsedData.rows.slice(0, 5), // First 5 rows only
        metadata: parsedData.metadata,
      })

      // Show unit selection dialog (blocking modal)
      setProcessingProgress(50)
      setPendingAnalysis({
        fieldAnalysis: fieldAnalysisResult.fields,
        parsedData: {
          headers: parsedData.headers,
          rows: parsedData.rows, // Full dataset for Stage 2
          metadata: parsedData.metadata,
        },
        filename: file.name,
        fileType,
      })
      setUnitDialogOpen(true)
      setUploading(false)
      setIsProcessing(false)
      setProcessingStep("")
      event.target.value = ""
      return
    } catch (error) {
      // Error safety: do NOT ingest partial data
      setUploadError(error instanceof Error ? error.message : "Failed to process file")
      setProcessingProgress(0)
      if (process.env.NODE_ENV === "development") {
        console.error("Ingestion error:", error)
      }
    } finally {
      setUploading(false)
      setIsProcessing(false)
      setProcessingStep("")
      // Keep progress at 100 if successful, reset to 0 if error
      if (!uploadError) {
        setTimeout(() => setProcessingProgress(0), 2000)
      }
    }
  }

  return (
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all duration-500 relative overflow-hidden group hover:scale-[1.01]">
      <div className="absolute inset-0 border border-transparent group-hover:border-slate-300/50 rounded-lg transition-all duration-300"></div>
      <div className="relative">
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-3 mb-6">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-soft-pulse"></span>
          Multi-Source Data Ingestion
        </h2>

      <Card className="p-6 border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/50 transition-all duration-300 relative group/card">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-slate-600 animate-float-gentle group-hover/card:text-slate-700 transition-colors" />
            <Label htmlFor="file-upload" className="text-base font-medium text-slate-900 cursor-pointer">
              Upload Astronomical Dataset
            </Label>
          </div>
          <p className="text-sm text-slate-600">Supported formats: CSV, JSON, FITS, XML</p>
          <Input
            id="file-upload"
            type="file"
            accept=".csv,.json,.fits,.xml"
            onChange={handleFileUpload}
            disabled={uploading || isProcessing}
            className="cursor-pointer"
          />
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Loader2 className="animate-spin h-4 w-4" />
                <span>{processingStep || "Processing astronomical data…"}</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
            </div>
          )}
          {uploadSuccess && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Dataset uploaded and processed successfully!
              </AlertDescription>
            </Alert>
          )}
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ingestedDatasets.map((ds, idx) => (
          <Card key={idx} className="p-6 hover:shadow-lg transition-all duration-500 hover:-translate-y-1 hover:scale-[1.02] group/card relative">
            <div className="absolute inset-0 border border-transparent group-hover/card:border-slate-300/50 rounded-lg transition-all duration-300"></div>
            <div className="relative">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">{ds.name}</h3>
                  <div className="flex items-center gap-2">
                    {ds.status === "completed" && (
                      <CheckCircle2 className="w-5 h-5 text-green-600 animate-soft-pulse" />
                    )}
                    <button
                      onClick={() => handleDeleteDataset(idx)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                      title="Remove dataset"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {ds.uploadedAt && (
                  <p className="text-xs text-slate-500 mt-1">
                    Uploaded {ds.uploadedAt.toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      </div>

      {/* Unit Selection Dialog - Blocking modal, no table rendering until confirmed */}
      {pendingAnalysis && (
        <UnitSelectionDialog
          open={unitDialogOpen}
          onOpenChange={setUnitDialogOpen}
          fields={pendingAnalysis.fieldAnalysis}
          onConfirm={handleUnitSelectionConfirm}
          onCancel={handleUnitSelectionCancel}
        />
      )}
    </section>
  )
}
