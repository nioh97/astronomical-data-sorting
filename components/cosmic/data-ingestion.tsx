"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { parseFile, type ColumnMetadataEntry } from "@/lib/file-parsers"
import { useDataContext, Dataset } from "@/lib/data-context"
import { analyzeFieldsWithLLM, FieldAnalysisResult } from "@/lib/field-analysis"
import {
  analyzeNASAFieldsWithLLM,
  buildNASAFieldAnalysisInput,
  UNIT_REGISTRY,
  type NASAFieldAnalysisFieldOutput,
} from "@/lib/llm-field-analysis"
import {
  type ConversionSpec,
  type ConversionFieldGuard,
  convertDatasetWithLLM,
} from "@/lib/llm-conversion"
import { normalizeUnit } from "@/lib/unit-normalization"
import { UNIT_TAXONOMY } from "@/lib/units/unitTaxonomy"
import { UnitSelectionDialog } from "./unit-selection-dialog"
import type { FITSResult } from "@/lib/fits/fits-types"
import { useAppUI } from "@/lib/app-ui-context"

const FITS_EXTENSIONS = [".fits", ".fit", ".fz"]

function isFitsFile(name: string): boolean {
  const lower = name.toLowerCase()
  return FITS_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Default fromUnit by physicalQuantity when no detected unit (e.g. NASA metadata). */
function defaultFromUnit(pq: string | undefined): string {
  const k = pq?.toLowerCase()
  switch (k) {
    case "time":
      return "day"
    case "length":
    case "distance":
      return "au"
    case "angle":
      return "deg"
    case "mass":
      return "kg"
    case "temperature":
      return "K"
    case "brightness":
      return "mag"
    case "acceleration":
      return "cm/s^2"
    default:
      return ""
  }
}

/** Build conversion specs with normalized units (for Qwen and factor lookup). Logarithmic/categorical fields are never included. */
function buildConversionSpecs(
  fieldAnalysis: FieldAnalysisResult[],
  selectedUnits: Record<string, string | null>,
  columnMetadata?: Record<string, ColumnMetadataEntry>
): ConversionSpec[] {
  console.log("🔨 Building conversion specs...")
  const specs: ConversionSpec[] = []
  for (const f of fieldAnalysis) {
    const fieldName = f.field_name
    // Skip non-linear encodings
    if (f.encoding === "logarithmic" || f.encoding === "sexagesimal" || f.encoding === "categorical" || f.encoding === "identifier") {
      console.log(`  ⏭️ ${fieldName}: SKIP (encoding=${f.encoding})`)
      continue
    }
    // Skip count/dimensionless
    if (f.physicalQuantity === "count" || f.physicalQuantity === "dimensionless") {
      console.log(`  ⏭️ ${fieldName}: SKIP (pq=${f.physicalQuantity})`)
      continue
    }
    // Get target unit
    const rawTo = selectedUnits[fieldName] ?? f.finalUnit
    if (rawTo == null || String(rawTo).trim() === "") {
      console.log(`  ⏭️ ${fieldName}: SKIP (no toUnit, rawTo=${rawTo})`)
      continue
    }
    const toUnit = normalizeUnit(String(rawTo).trim())
    // Get source unit
    const rawFrom = columnMetadata?.[fieldName]?.detectedUnit ?? defaultFromUnit(f.physicalQuantity)
    if (!rawFrom) {
      console.log(`  ⏭️ ${fieldName}: SKIP (no fromUnit, rawFrom=${rawFrom})`)
      continue
    }
    const fromUnit = normalizeUnit(String(rawFrom).trim())
    // Skip if same unit (no conversion needed)
    if (fromUnit === toUnit) {
      console.log(`  ⏭️ ${fieldName}: SKIP (fromUnit===toUnit: ${fromUnit})`)
      continue
    }
    console.log(`  ✅ ${fieldName}: ${fromUnit} → ${toUnit}`)
    specs.push({
      field: fieldName,
      physicalQuantity: f.physicalQuantity ?? "dimensionless",
      fromUnit,
      toUnit,
      encoding: (f.encoding ?? "linear") as "linear" | "logarithmic" | "sexagesimal" | "categorical" | "identifier",
    })
  }
  console.log(`🔨 Built ${specs.length} conversion specs`)
  return specs
}

function mapNASAFieldsToAnalysisResult(
  nasaFields: NASAFieldAnalysisFieldOutput[]
): FieldAnalysisResult[] {
  return nasaFields.map((f) => ({
    field_name: f.name,
    semantic_type: f.semanticType,
    unit_required: "unitRequired" in f && typeof f.unitRequired === "boolean" ? f.unitRequired : f.physicalQuantity !== "dimensionless",
    allowed_units: Array.isArray(f.suggestedUnits) ? f.suggestedUnits : [],
    recommended_unit: f.recommendedUnit ?? null,
    reason: f.physicalQuantity !== "dimensionless" ? `Physical quantity: ${f.physicalQuantity}` : "Dimensionless",
    physicalQuantity: f.physicalQuantity,
    timeKind: f.timeKind,
    encoding: f.encoding,
  }))
}

interface IngestedDataset {
  name: string
  status: "pending" | "processing" | "completed" | "error"
  uploadedAt?: Date
}

export default function DataIngestionSection() {
  const { addDataset } = useDataContext()
  const { toast } = useToast()
  const appUI = useAppUI()
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
    columnMetadata?: Record<string, ColumnMetadataEntry>
  } | null>(null)
  const [analysisUsedFallback, setAnalysisUsedFallback] = useState(false)
  const cancelRef = useRef(false)
  const [fitsResults, setFitsResults] = useState<FITSResult[]>([])

  // UX4G: report mode/stage/file to status bar (UI-only, no logic change)
  useEffect(() => {
    if (unitDialogOpen) {
      appUI.setMode("awaiting_units")
      appUI.setCurrentStage("units")
      if (pendingAnalysis) {
        appUI.setFileName(pendingAnalysis.filename)
        appUI.setFileType(pendingAnalysis.fileType.toUpperCase() as "CSV" | "JSON" | "XML")
        appUI.setDatasetSize(`${pendingAnalysis.parsedData.rows.length} rows, ${pendingAnalysis.parsedData.headers.length} columns`)
      }
      return
    }
    if (uploading || isProcessing) {
      if (processingStep.toLowerCase().includes("convert")) {
        appUI.setMode("converting")
        appUI.setCurrentStage("convert")
      } else if (processingStep.toLowerCase().includes("analyz") || processingStep.toLowerCase().includes("pars")) {
        appUI.setMode(uploading ? "uploading" : "analyzing")
        appUI.setCurrentStage(uploading ? "upload" : "analyze")
      } else {
        appUI.setMode(uploading ? "uploading" : "analyzing")
        appUI.setCurrentStage("upload")
      }
      return
    }
    if (uploadSuccess || ingestedDatasets.length > 0 || fitsResults.length > 0) {
      appUI.setMode("ready")
      appUI.setCurrentStage("repository")
      if (fitsResults.length > 0) {
        appUI.setFileName(fitsResults[0]?.fileName ?? "")
        appUI.setFileType("FITS")
        appUI.setDatasetSize(`${fitsResults.reduce((n, r) => n + r.hdus.length, 0)} HDUs`)
      } else if (ingestedDatasets.length > 0) {
        appUI.setFileName(ingestedDatasets[0]?.name ?? "")
        appUI.setFileType("CSV")
        appUI.setDatasetSize(`${ingestedDatasets.length} dataset(s)`)
      }
      return
    }
    appUI.setMode("idle")
    appUI.setCurrentStage("upload")
    appUI.setFileName("")
    appUI.setFileType(null)
    appUI.setDatasetSize("")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- appUI setters are stable; only sync when pipeline state changes
  }, [uploading, isProcessing, processingStep, unitDialogOpen, pendingAnalysis, uploadSuccess, ingestedDatasets, fitsResults])

  const handleDeleteDataset = (index: number) => {
    setIngestedDatasets((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRemoveFitsResult = (index: number) => {
    setFitsResults((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUnitSelectionConfirm = async (selectedUnits: Record<string, string | null>) => {
    if (!pendingAnalysis) return

    // Show warning if fallback was used BUT DO NOT BLOCK - user can still select units and convert
    if (analysisUsedFallback) {
      toast({
        title: "Using fallback field classification",
        description: "Field analysis used fallback schema. Please verify unit selections.",
        variant: "default",
      })
      // DO NOT return - allow conversion to proceed with user-selected units
    }

    // Validate: required fields must have a unit (unless count, dimensionless, logarithmic, sexagesimal, identifier)
    const missing = pendingAnalysis.fieldAnalysis.some(
      (f) =>
        f.unit_required &&
        !(selectedUnits[f.field_name] ?? f.finalUnit) &&
        !["count", "dimensionless"].includes(f.physicalQuantity ?? "") &&
        f.encoding !== "logarithmic" &&
        f.encoding !== "sexagesimal" &&
        f.encoding !== "identifier"
    )
    if (missing) {
      toast({
        title: "Please confirm all required units",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    setProcessingStep("Normalizing units…")
    setProcessingProgress(10)
    cancelRef.current = false

    // ==================== HARD DEBUG LOGGING ====================
    console.group("🔄 CONVERSION PIPELINE START")
    console.time("UNIT_CONVERSION_TOTAL")
    console.log("📋 UnitSelectionMap:", JSON.stringify(selectedUnits, null, 2))
    // ============================================================

    try {
      const { parsedData, filename } = pendingAnalysis
      const { fieldAnalysis, columnMetadata } = pendingAnalysis

      // DEBUG: Log field analysis
      console.log("📊 Field Analysis:", fieldAnalysis.map(f => ({
        name: f.field_name,
        pq: f.physicalQuantity,
        unitRequired: f.unit_required,
        encoding: f.encoding,
        recommended: f.recommended_unit,
        finalUnit: f.finalUnit,
      })))

      const conversionSpecs = buildConversionSpecs(
        fieldAnalysis,
        selectedUnits,
        columnMetadata
      )

      // DEBUG: Log conversion specs
      console.log("🔧 ConversionSpecs:", conversionSpecs.map(s => ({
        field: s.field,
        from: s.fromUnit,
        to: s.toUnit,
        pq: s.physicalQuantity,
      })))

      // Check if any fields REQUIRE conversion but couldn't be converted
      // (i.e., unit_required is true, linear encoding, different source/target, but no spec built)
      const linearConvertibleFields = fieldAnalysis.filter(
        (f) => f.encoding !== "logarithmic" && 
               f.encoding !== "sexagesimal" && 
               f.encoding !== "categorical" && 
               f.encoding !== "identifier" &&
               f.physicalQuantity !== "count" &&
               f.physicalQuantity !== "dimensionless" &&
               f.unit_required
      )
      
      // Only block if there are fields that need conversion AND we couldn't build specs for them
      // AND the reason is not "same unit" (fromUnit === toUnit is fine)
      const fieldsNeedingConversionButMissing = linearConvertibleFields.filter((f) => {
        const rawTo = selectedUnits[f.field_name] ?? f.finalUnit
        const rawFrom = columnMetadata?.[f.field_name]?.detectedUnit ?? defaultFromUnit(f.physicalQuantity)
        
        // If no target unit selected, that's a problem
        if (!rawTo || String(rawTo).trim() === "") {
          console.log(`  ⚠️ ${f.field_name}: No target unit selected`)
          return true
        }
        
        // If no source unit detected, warn but don't block
        if (!rawFrom || String(rawFrom).trim() === "") {
          console.log(`  ⚠️ ${f.field_name}: No source unit detected (will use raw values)`)
          return false // Don't block - just use raw values
        }
        
        // If same unit, no conversion needed - that's fine
        const fromNorm = normalizeUnit(String(rawFrom).trim())
        const toNorm = normalizeUnit(String(rawTo).trim())
        if (fromNorm === toNorm) {
          console.log(`  ✓ ${f.field_name}: Same unit (${fromNorm}), no conversion needed`)
          return false // Not missing - just no conversion needed
        }
        
        // Check if spec was created
        const hasSpec = conversionSpecs.some(s => s.field === f.field_name)
        if (!hasSpec) {
          console.log(`  ❌ ${f.field_name}: Needs conversion ${fromNorm} → ${toNorm} but no spec created`)
          return true
        }
        
        return false
      })
      
      if (fieldsNeedingConversionButMissing.length > 0) {
        const fieldNames = fieldsNeedingConversionButMissing.map(f => f.field_name).join(", ")
        throw new Error(`Cannot convert fields: ${fieldNames}. Please select valid target units.`)
      }
      
      // If no specs but that's because all fields are same-unit or non-convertible, that's OK
      if (conversionSpecs.length === 0) {
        console.log("📋 No conversions needed - all fields have matching units or are non-convertible")
      }

      setProcessingStep("Normalizing units ✔")
      setProcessingProgress(15)

      const fieldsForGuard: ConversionFieldGuard[] = fieldAnalysis.map((f) => ({
        name: f.field_name,
        unitRequired: f.unit_required,
        finalUnit: normalizeUnit(String((selectedUnits[f.field_name] ?? f.finalUnit) ?? "").trim()) || null,
        physicalQuantity: f.physicalQuantity,
        timeKind: f.timeKind,
        encoding: f.encoding as "linear" | "logarithmic" | "sexagesimal" | "categorical" | "identifier" | undefined,
      }))

      let rowsToStore: Record<string, number | string | null>[]
      let columns: { name: string; semanticType: string; unit: string | null; description: string }[]
      const datasetName = filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_")

      if (conversionSpecs.length > 0) {
        setProcessingStep("Converting…")
        const converted = await convertDatasetWithLLM({
          filename,
          headers: parsedData.headers,
          rows: parsedData.rows,
          conversionSpecs,
          fields: fieldsForGuard,
          onChunkProgress: (chunkIndex, totalChunks) => {
            setProcessingStep(`Converting chunk ${chunkIndex + 1} / ${totalChunks} 🔄`)
            setProcessingProgress(20 + Math.round((50 * (chunkIndex + 1)) / totalChunks))
          },
          getCancelRef: () => cancelRef.current,
        })

        if (!converted || converted.rows.length === 0) {
          throw new Error("Conversion did not produce output")
        }

        setProcessingStep("Validating conversions ✔")
        setProcessingProgress(75)
        rowsToStore = converted.rows
        columns = converted.columns
      } else {
        rowsToStore = parsedData.rows as Record<string, number | string | null>[]
        columns = parsedData.headers.map((name) => {
          const f = fieldAnalysis.find((x) => x.field_name === name)
          const unit = selectedUnits[name] ?? f?.finalUnit ?? f?.recommended_unit ?? null
          return {
            name,
            semanticType: f?.physicalQuantity ?? "",
            unit,
            description: f?.physicalQuantity ?? "",
          }
        })
      }

      // ==================== CONVERSION RESULTS DEBUG ====================
      console.log("📥 BEFORE conversion (row 0):", JSON.stringify(parsedData.rows[0], null, 2))
      console.log("📤 AFTER conversion (row 0):", JSON.stringify(rowsToStore[0], null, 2))
      
      // Log per-field comparison
      console.log("🔬 Per-field conversion comparison:")
      for (const spec of conversionSpecs) {
        const before = parsedData.rows[0]?.[spec.field]
        const after = rowsToStore[0]?.[spec.field]
        const changed = before !== after
        console.log(`  ${spec.field}: ${before} → ${after} (${spec.fromUnit} → ${spec.toUnit}) [${changed ? "✅ CHANGED" : "⚠️ UNCHANGED"}]`)
      }
      
      console.timeEnd("UNIT_CONVERSION_TOTAL")
      console.table({
        usedFallback: analysisUsedFallback,
        fieldsConverted: conversionSpecs.length,
        ingestionBlocked: false,
        rowCount: rowsToStore.length,
      })
      console.groupEnd()
      // ==================================================================

      setProcessingStep("Ingesting ✔")
      setProcessingProgress(90)
      console.log("💾 Saving rows count:", rowsToStore.length)

      const dataset: Dataset = {
        id: `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: datasetName,
        columns,
        rows: rowsToStore,
        sourceFile: filename,
        createdAt: new Date().toISOString(),
      }

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
      const message = error instanceof Error ? error.message : "Failed to convert and store dataset"
      setUploadError(message)
      setProcessingProgress(0)
      // ==================== ERROR DEBUG ====================
      console.error("❌ CONVERSION FAILED:", message)
      console.error("Full error:", error)
      console.table({
        usedFallback: analysisUsedFallback,
        fieldsConverted: 0,
        ingestionBlocked: true,
        errorMessage: message,
      })
      console.groupEnd()
      // =====================================================
      toast({
        title: "Conversion failed",
        description: message,
        variant: "destructive",
      })
      // Do NOT close modal on failure — user can fix and retry
    } finally {
      setIsProcessing(false)
      setProcessingStep("")
      setTimeout(() => setProcessingProgress(0), 2000)
    }
  }

  const handleUnitSelectionCancel = () => {
    setPendingAnalysis(null)
    setUnitDialogOpen(false)
    setAnalysisUsedFallback(false)
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
      // FITS path — isolated; no parseFile, no LLM, no unit dialog, no repository
      if (isFitsFile(file.name)) {
        setProcessingStep("Processing FITS file…")
        setProcessingProgress(20)
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch("/api/fits", { method: "POST", body: formData })
        const data = await res.json().catch(() => ({}))
        setUploading(false)
        setIsProcessing(false)
        setProcessingStep("")
        event.target.value = ""
        if (!res.ok) {
          // Only show "corrupted" when open failed or no numeric HDU; never for visualization/header issues
          const raw = data?.error ?? ""
          const isOpenOrNoNumeric =
            /cannot be opened|astropy|not installed|No numeric|no numeric HDU/i.test(raw)
          const message = isOpenOrNoNumeric
            ? raw || "This FITS file could not be opened or contains no numeric data."
            : raw || "This FITS file could not be processed."
          setUploadError(message)
          setProcessingProgress(0)
          toast({
            title: "FITS ingestion failed",
            description: message || "This FITS file could not be processed.",
            variant: "destructive",
          })
          return
        }
        setFitsResults((prev) => [{ ...data, status: data.status ?? "success", fileName: data.fileName ?? file.name, hdus: data.hdus ?? [] } as FITSResult, ...prev])
        if (data.status === "valid_no_visualizable_data") {
          toast({
            title: "FITS file valid",
            description: data.message ?? "This FITS file is valid but contains no visualizable data products.",
            variant: "default",
          })
        } else {
          setUploadSuccess(true)
          setTimeout(() => setUploadSuccess(false), 3000)
        }
        setTimeout(() => setProcessingProgress(0), 2000)
        return
      }

      // STAGE 1: Parse the file (CSV/JSON/XML only)
      setProcessingStep("Parsing file…")
      setProcessingProgress(10)
      const parsedData = await parseFile(file)
      
      if (parsedData.rows.length === 0) {
        throw new Error("File contains no data rows")
      }

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

      // Phase A: Column discovery is local (headers from parser; NASA # lines ignored in file-parsers).
      // Phase B: Field semantics (NASA: batched max 4; standard: single call). Retry + fallback; never throw.
      cancelRef.current = false
      setAnalysisUsedFallback(false)
      setProcessingStep("Analyzing fields with AI…")
      setProcessingProgress(30)
      let fieldAnalysisResult: {
        fields: FieldAnalysisResult[]
        usedFallback?: boolean
        analysisSource?: "llm" | "fallback"
      }
      if (parsedData.columnMetadata && Object.keys(parsedData.columnMetadata).length > 0) {
        setProcessingStep("Analyzing field semantics (batched)…")
        const nasaInput = buildNASAFieldAnalysisInput(
          file.name,
          parsedData.headers,
          parsedData.rows.slice(0, 3),
          parsedData.columnMetadata
        )
        const nasaOutput = await analyzeNASAFieldsWithLLM(nasaInput)
        if (cancelRef.current) {
          setUploading(false)
          setIsProcessing(false)
          setProcessingStep("")
          event.target.value = ""
          return
        }
        if (nasaOutput.fields.length > 0) {
          fieldAnalysisResult = {
            fields: mapNASAFieldsToAnalysisResult(nasaOutput.fields),
            usedFallback: nasaOutput.usedFallback,
            analysisSource: nasaOutput.analysisSource,
          }
        } else {
          const fallback = await analyzeFieldsWithLLM({
            filename: file.name,
            fileType,
            headers: parsedData.headers,
            sampleRows: parsedData.rows.slice(0, 3),
            metadata: parsedData.metadata,
          })
          fieldAnalysisResult = { fields: fallback.fields, usedFallback: fallback.usedFallback }
        }
      } else {
        const result = await analyzeFieldsWithLLM({
          filename: file.name,
          fileType,
          headers: parsedData.headers,
          sampleRows: parsedData.rows.slice(0, 3),
          metadata: parsedData.metadata,
        })
        if (cancelRef.current) {
          setUploading(false)
          setIsProcessing(false)
          setProcessingStep("")
          event.target.value = ""
          return
        }
        fieldAnalysisResult = { fields: result.fields, usedFallback: result.usedFallback }
      }
      setAnalysisUsedFallback(
        fieldAnalysisResult.analysisSource === "fallback" || !!fieldAnalysisResult.usedFallback
      )

      // Auto-populate allowed_units from canonical taxonomy; set finalUnit from recommended_unit
      const enrichedFields = fieldAnalysisResult.fields.map((f) => {
        if (f.physicalQuantity === "time" && f.timeKind === "calendar") {
          return {
            ...f,
            unit_required: false,
            allowed_units: [],
            finalUnit: "ISO_DATE",
          }
        }
        const allowed_units = UNIT_REGISTRY[f.physicalQuantity ?? ""]?.length
          ? UNIT_REGISTRY[f.physicalQuantity ?? ""]
          : (UNIT_TAXONOMY[f.physicalQuantity ?? ""] ?? [])
        return {
          ...f,
          allowed_units,
          finalUnit:
            f.unit_required && f.recommended_unit ? f.recommended_unit : (f.finalUnit ?? null),
        }
      })

      // Show unit selection dialog (blocking modal)
      setProcessingProgress(50)
      setPendingAnalysis({
        fieldAnalysis: enrichedFields,
        parsedData: {
          headers: parsedData.headers,
          rows: parsedData.rows,
          metadata: parsedData.metadata,
        },
        filename: file.name,
        fileType,
        columnMetadata: parsedData.columnMetadata,
      })
      setUnitDialogOpen(true)
      setUploading(false)
      setIsProcessing(false)
      setProcessingStep("")
      event.target.value = ""
      return
    } catch (error) {
      setUploadError("Ingestion failed — retry")
      setProcessingProgress(0)
      if (typeof console !== "undefined" && console.warn) console.warn("Ingestion error:", error)
      toast({
        title: "Ingestion failed — retry",
        description: error instanceof Error ? error.message : "Processing failed",
        variant: "destructive",
      })
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
    <section className="space-y-6 bg-zinc-900 rounded-lg border border-zinc-700 p-6" aria-labelledby="stage-upload-title">
      <div>
        <h2 id="stage-upload-title" className="text-xl font-semibold text-zinc-100 mb-1">
          Upload
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Drop a file to begin. Supported formats: CSV, JSON, FITS, XML. Structure is analyzed before unit selection.
        </p>

      <Card className="p-6 border-2 border-dashed border-zinc-600 bg-zinc-800/50">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-zinc-400 animate-float-gentle group-hover/card:text-zinc-300 transition-colors" />
            <Label htmlFor="file-upload" className="text-base font-medium text-zinc-100 cursor-pointer">
              Upload Astronomical Dataset
            </Label>
          </div>
          <p className="text-sm text-zinc-400">Supported formats: CSV, JSON, FITS, XML</p>
          <Input
            id="file-upload"
            type="file"
            accept=".csv,.json,.fits,.fit,.fz,.xml"
            onChange={handleFileUpload}
            disabled={uploading || isProcessing}
            className="cursor-pointer bg-zinc-800 border-zinc-600 text-zinc-100 file:bg-zinc-700 file:text-zinc-100 file:border-0"
          />
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm text-zinc-400">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>{processingStep || "Processing astronomical data…"}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { cancelRef.current = true }}
                  className="text-zinc-400 hover:text-zinc-100"
                >
                  Cancel
                </Button>
              </div>
              <Progress value={processingProgress} className="h-2" />
            </div>
          )}
          {analysisUsedFallback && !isProcessing && (
            <Alert variant="destructive" className="bg-red-900/30 border-red-800">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                AI field analysis failed. Conversion accuracy is NOT guaranteed. Conversion is DISABLED.
              </AlertDescription>
            </Alert>
          )}
          {uploadSuccess && (
            <Alert className="bg-emerald-900/30 border-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <AlertDescription className="text-emerald-300">
                Dataset uploaded and processed successfully!
              </AlertDescription>
            </Alert>
          )}
          {uploadError && (
            <Alert variant="destructive" className="bg-red-900/30 border-red-800">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">{uploadError}</AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ingestedDatasets.map((ds, idx) => (
          <Card key={idx} className="p-6 bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-all duration-300 group/card relative">
            <div className="relative">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-zinc-100">{ds.name}</h3>
                  <div className="flex items-center gap-2">
                    {ds.status === "completed" && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    )}
                    <button
                      onClick={() => handleDeleteDataset(idx)}
                      className="text-zinc-500 hover:text-red-400 transition-colors"
                      title="Remove dataset"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {ds.uploadedAt && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Uploaded {ds.uploadedAt.toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {fitsResults.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-zinc-100 mb-2">FITS Previews (read-only)</h3>
          <p className="text-sm text-zinc-400 mb-4">Each HDU is its own card. Preview images are auto-scaled; metadata is collapsible.</p>
          <div className="space-y-6">
            {fitsResults.map((result, resultIdx) => (
              <Card key={resultIdx} className="p-6 bg-zinc-800 border-zinc-700 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-zinc-100">{result.fileName}</h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveFitsResult(resultIdx)}
                    className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                    title="Remove FITS preview"
                    aria-label="Remove FITS preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {result.status === "valid_no_visualizable_data" && (result.message ?? result.error) && (
                  <Alert className="bg-blue-900/30 border-blue-800 mb-4">
                    <AlertDescription className="text-blue-300">
                      ℹ️ {result.message ?? result.error ?? "This FITS file is valid but contains no visualizable data products."}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-4">
                  {result.hdus.map((hdu) => (
                    <div key={hdu.index} className="border border-zinc-700 rounded-lg p-4 bg-zinc-900/50">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-zinc-200">HDU {hdu.index}</span>
                        <span className="text-xs text-zinc-400">{hdu.type}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">
                          {hdu.classification === "error_map"
                            ? "Error Map"
                            : hdu.classification === "low_contrast_image"
                              ? "Low Contrast"
                              : hdu.classification === "image" || hdu.classification === "unknown"
                                ? "Science Image"
                                : hdu.classification}
                        </span>
                      </div>
                      {hdu.previewImage && (
                        <div className="mb-3">
                          <img
                            src={hdu.previewImage}
                            alt={`HDU ${hdu.index} preview`}
                            className="max-w-full max-h-64 object-contain rounded border border-zinc-700"
                          />
                          <p className="text-xs text-zinc-500 mt-1 font-mono" title="ZScale and percentile scaling are used to auto-enhance contrast for display; data values are unchanged.">
            Stretch: Auto (ZScale/percentile). Contrast auto-enhanced for visibility.
          </p>
                        </div>
                      )}
                      {Object.keys(hdu.units).length > 0 && (
                        <p className="text-xs text-zinc-400 mb-1">
                          Units: {Object.entries(hdu.units).map(([k, v]) => `${k}=${v}`).join(", ")}
                        </p>
                      )}
                      {Object.keys(hdu.metadata).length > 0 && (
                        <details className="text-xs text-zinc-400">
                          <summary className="cursor-pointer hover:text-zinc-200">Header metadata</summary>
                          <pre className="mt-1 p-2 bg-zinc-900 rounded border border-zinc-700 overflow-auto max-h-32 text-zinc-300">
                            {JSON.stringify(hdu.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Unit Selection Dialog - Blocking modal, no table rendering until confirmed */}
      {pendingAnalysis && (
        <UnitSelectionDialog
          key={pendingAnalysis.filename}
          open={unitDialogOpen}
          onOpenChange={setUnitDialogOpen}
          fields={pendingAnalysis.fieldAnalysis}
          onConfirm={handleUnitSelectionConfirm}
          onCancel={handleUnitSelectionCancel}
          columnMetadata={pendingAnalysis.columnMetadata}
          conversionDisabled={analysisUsedFallback}
          isProcessing={isProcessing}
          processingStep={processingStep}
          processingProgress={processingProgress}
        />
      )}
    </section>
  )
}
