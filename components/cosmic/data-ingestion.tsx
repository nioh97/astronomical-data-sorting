"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { parseFile } from "@/lib/file-parsers"
import { standardizeData, CustomFieldMapping } from "@/lib/standardization"
import { useDataContext } from "@/lib/data-context"
import { inferFieldMappings, FieldInference } from "@/lib/ai-inference"
import { FieldInferenceDialog } from "./field-inference-dialog"

interface IngestedDataset {
  name: string
  agency: string
  format: string
  fields: string[]
  units: string[]
  status: "pending" | "processing" | "completed" | "error"
  uploadedAt?: Date
  previewRows?: Record<string, any>[]
}


export default function DataIngestionSection() {
  const { addStandardizedData } = useDataContext()
  const [ingestedDatasets, setIngestedDatasets] = useState<IngestedDataset[]>([])
  const [uploading, setUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>("")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [inferenceDialogOpen, setInferenceDialogOpen] = useState(false)
  const [pendingParsedData, setPendingParsedData] = useState<{ parsedData: any; agency: string; fileName: string } | null>(null)
  const [inferenceResult, setInferenceResult] = useState<{ fields: FieldInference[]; needsValidation: boolean } | null>(null)

  const detectAgency = (fileName: string): string => {
    const lower = fileName.toLowerCase()
    if (lower.includes("nasa")) return "NASA"
    if (lower.includes("esa")) return "ESA"
    if (lower.includes("jaxa")) return "JAXA"
    if (lower.includes("gaia")) return "ESA"
    if (lower.includes("hubble") || lower.includes("jwst")) return "NASA"
    if (lower.includes("skyscribe")) return "SkyScribe"
    if (lower.includes("vizier")) return "VizieR"
    return "Unknown Agency"
  }
  const handleDeleteDataset = (index: number) => {
  setIngestedDatasets((prev) => prev.filter((_, i) => i !== index))
}


  const detectUnits = (headers: string[]): string[] => {
    return headers.map((header) => {
      const lower = header.toLowerCase()
      if (lower.includes("ra") || lower.includes("right_ascension")) {
        return lower.includes("rad") ? "radians" : "degrees"
      }
      if (lower.includes("dec") || lower.includes("declination")) {
        return lower.includes("rad") ? "radians" : "degrees"
      }
      if (lower.includes("dist") || lower.includes("distance")) {
        if (lower.includes("au")) return "AU"
        if (lower.includes("ly") || lower.includes("light")) return "light years"
        if (lower.includes("pc") || lower.includes("parsec")) return "parsecs"
        if (lower.includes("km")) return "km"
        return "AU"
      }
      if (lower.includes("parallax")) return "arcseconds"
      if (lower.includes("mag") || lower.includes("magnitude") || lower.includes("brightness")) {
        return "magnitude"
      }
      if (lower.includes("time") || lower.includes("date") || lower.includes("timestamp")) {
        return "ISO 8601"
      }
      return "unknown"
    })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setIsProcessing(true)
    setUploadError(null)
    setUploadSuccess(false)
    setProcessingStep("")

    try {
      // Step 1: Parse the file
      setProcessingStep("Parsing file…")
      const parsedData = await parseFile(file)
      
      if (parsedData.rows.length === 0) {
        throw new Error("File contains no data rows")
      }

      // Detect agency from filename
      const agency = detectAgency(file.name)
      const format = file.name.split(".").pop()?.toUpperCase() || "UNKNOWN"

      // Extract field schemas from metadata if available (for XML files)
      const fieldSchemas = parsedData.metadata?.fieldSchemas?.map((fs: any) => ({
        name: fs.name,
        unit: fs.unit,
        datatype: fs.datatype,
        ucd: fs.ucd,
        xtype: fs.xtype,
      }))

      // Step 2: Check if AI inference is needed
      setProcessingStep("Running inference…")
      const inference = await inferFieldMappings(parsedData, fieldSchemas)
      
      // Step 3: If LLM was used, show dialog for validation
      if (inference.needsValidation) {
        setPendingParsedData({ parsedData, agency, fileName: file.name })
        setInferenceResult({ fields: inference.fields, needsValidation: inference.needsValidation })
        setInferenceDialogOpen(true)
        setUploading(false)
        setIsProcessing(false)
        setProcessingStep("")
        event.target.value = ""
        return
      }

      // Step 4: Standardize data
      setProcessingStep("Standardizing units…")
      const standardizationResult = standardizeData(
        parsedData.rows,
        parsedData.headers,
        file.name, // Use filename as source
        undefined // No custom mappings if no validation needed
      )
      
      // DEBUG: Verify standardized data before adding to context
      console.log("Standardized data (no validation):", standardizationResult)
      console.log("Standardized data count:", standardizationResult.rows.length)
      console.log("Schema key:", standardizationResult.schemaKey)
      console.log("Fields:", standardizationResult.fields)
      
      // Step 5: Add to unified repository
      setProcessingStep("Adding to repository…")
      if (standardizationResult.rows.length > 0) {
        addStandardizedData(
          standardizationResult.rows,
          standardizationResult.schemaKey,
          file.name,
          standardizationResult.fields
        )
        console.log("Data added to context, total rows:", standardizationResult.rows.length)
      } else {
        console.warn("No standardized data to add - array is empty or invalid")
      }

      // Create dataset record
      const units = inference.fields.map((f) => f.suggestedUnit)
      const newDataset: IngestedDataset = {
        name: file.name,
        agency,
        format,
        fields: parsedData.headers,
        units,
        status: "completed",
        uploadedAt: new Date(),
        previewRows: parsedData.rows.slice(0, 5),
      }


      setIngestedDatasets([newDataset, ...ingestedDatasets])
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)

      // Reset file input
      event.target.value = ""
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to process file")
    } finally {
      setUploading(false)
      setIsProcessing(false)
      setProcessingStep("")
    }
  }

  const handleInferenceConfirm = (inferences: FieldInference[]) => {
    if (!pendingParsedData) return

    setIsProcessing(true)
    setProcessingStep("Standardizing units…")

    try {
      // Convert inferences to custom mappings
      const customMappings: CustomFieldMapping[] = inferences.map((inf) => ({
        originalField: inf.fieldName,
        canonicalField: inf.suggestedCanonicalField,
        unit: inf.suggestedUnit,
      }))

      // Standardize with custom mappings
      // Use filename as source (more specific than agency)
      const standardizationResult = standardizeData(
        pendingParsedData.parsedData.rows,
        pendingParsedData.parsedData.headers,
        pendingParsedData.fileName, // Use filename as source
        customMappings
      )

      // DEBUG: Verify standardized data before adding to context
      console.log("Standardized data (with AI inference):", standardizationResult)
      console.log("Standardized data count:", standardizationResult.rows.length)
      console.log("Schema key:", standardizationResult.schemaKey)
      console.log("Fields:", standardizationResult.fields)

      // Add to unified repository
      setProcessingStep("Adding to repository…")
      if (standardizationResult.rows.length > 0) {
        addStandardizedData(
          standardizationResult.rows,
          standardizationResult.schemaKey,
          pendingParsedData.fileName,
          standardizationResult.fields
        )
        console.log("Data added to context, total rows:", standardizationResult.rows.length)
      } else {
        console.warn("No standardized data to add - array is empty or invalid")
      }
    } finally {
      setIsProcessing(false)
      setProcessingStep("")
    }

    // Create dataset record
    const units = inferences.map((f) => f.suggestedUnit)
    const newDataset: IngestedDataset = {
      name: pendingParsedData.fileName,
      agency: pendingParsedData.agency,
      format: pendingParsedData.fileName.split(".").pop()?.toUpperCase() || "UNKNOWN",
      fields: pendingParsedData.parsedData.headers,
      units,
      status: "completed",
      uploadedAt: new Date(),
    }

    setIngestedDatasets([newDataset, ...ingestedDatasets])
    setUploadSuccess(true)
    setTimeout(() => setUploadSuccess(false), 3000)

    // Reset state
    setPendingParsedData(null)
    setInferenceResult(null)
    setInferenceDialogOpen(false)
  }

  const handleInferenceReject = () => {
    if (!pendingParsedData) return

    setIsProcessing(true)
    setProcessingStep("Standardizing units…")

    try {
      // Standardize without custom mappings (use rule-based only)
      // Use filename as source (more specific than agency)
      const standardizationResult = standardizeData(
        pendingParsedData.parsedData.rows,
        pendingParsedData.parsedData.headers,
        pendingParsedData.fileName // Use filename as source
      )

      // DEBUG: Verify standardized data before adding to context
      console.log("Standardized data (rejected AI inference):", standardizationResult)
      console.log("Standardized data count:", standardizationResult.rows.length)
      console.log("Schema key:", standardizationResult.schemaKey)
      console.log("Fields:", standardizationResult.fields)

      // Add to unified repository
      setProcessingStep("Adding to repository…")
      if (standardizationResult.rows.length > 0) {
        addStandardizedData(
          standardizationResult.rows,
          standardizationResult.schemaKey,
          pendingParsedData.fileName,
          standardizationResult.fields
        )
        console.log("Data added to context, total rows:", standardizationResult.rows.length)
      } else {
        console.warn("No standardized data to add - array is empty or invalid")
      }
    } finally {
      setIsProcessing(false)
      setProcessingStep("")
    }

    // Create dataset record
    const units = detectUnits(pendingParsedData.parsedData.headers)
    const newDataset: IngestedDataset = {
      name: pendingParsedData.fileName,
      agency: pendingParsedData.agency,
      format: pendingParsedData.fileName.split(".").pop()?.toUpperCase() || "UNKNOWN",
      fields: pendingParsedData.parsedData.headers,
      units,
      status: "completed",
      uploadedAt: new Date(),
    }

    setIngestedDatasets([newDataset, ...ingestedDatasets])
    setUploadSuccess(true)
    setTimeout(() => setUploadSuccess(false), 3000)

    // Reset state
    setPendingParsedData(null)
    setInferenceResult(null)
    setInferenceDialogOpen(false)
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
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Loader2 className="animate-spin h-4 w-4" />
              <span>{processingStep || "Processing astronomical data…"}</span>
            </div>
          )}
          {uploading && !isProcessing && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              Processing file...
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

              <p className="text-sm text-slate-600">{ds.agency}</p>
              {ds.uploadedAt && (
                <p className="text-xs text-slate-500 mt-1">
                  Uploaded {ds.uploadedAt.toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Format</p>
                <p className="text-sm font-mono text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block">
                  {ds.format}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Field Names</p>
                <div className="flex flex-wrap gap-2">
                  {ds.fields.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700 font-mono hover:bg-slate-200 hover:border-slate-300 transition-all duration-200 cursor-default"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Units</p>
                <div className="flex flex-wrap gap-2">
                  {ds.units.map((u, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-slate-600 font-mono hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 cursor-default animate-soft-pulse"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <Button
            variant="outline"
            className="w-full hover:scale-[1.02] transition-transform duration-200"
            disabled={ds.status !== "completed"}
            onClick={() => setPreviewIndex(previewIndex === idx ? null : idx)}
          >
            {previewIndex === idx ? "Hide Preview" : "View Details"}
          </Button>
          {previewIndex === idx && ds.previewRows && (
  <div className="mt-4 overflow-x-auto border rounded-md bg-slate-50">
    <table className="w-full text-xs font-mono">
      <thead className="bg-slate-200">
        <tr>
          {ds.fields.map((field, i) => (
            <th key={i} className="px-2 py-1 text-left border">
              {field}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ds.previewRows.map((row, rIdx) => (
          <tr key={rIdx} className="border-t">
            {ds.fields.map((field, cIdx) => (
              <td key={cIdx} className="px-2 py-1 border">
                {String(row[field] ?? "—")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}


            </div>
          </Card>
        ))}
      </div>
      </div>

      {/* AI Inference Dialog */}
      {inferenceResult && (
        <FieldInferenceDialog
          open={inferenceDialogOpen}
          onOpenChange={setInferenceDialogOpen}
          inferences={inferenceResult.fields}
          onConfirm={handleInferenceConfirm}
          onReject={handleInferenceReject}
        />
      )}
    </section>
  )
}
