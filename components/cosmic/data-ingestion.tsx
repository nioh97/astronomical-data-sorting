"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
}

export default function DataIngestionSection() {
  const { addStandardizedData } = useDataContext()
  const [ingestedDatasets, setIngestedDatasets] = useState<IngestedDataset[]>([])
  const [uploading, setUploading] = useState(false)
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
    setUploadError(null)
    setUploadSuccess(false)

    try {
      // Parse the file
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

      // Step 1: Try rule-based standardization first
      const standardized = standardizeData(parsedData.rows, parsedData.headers, agency)
      
      // Step 2: Check if AI inference is needed
      const inference = await inferFieldMappings(parsedData, fieldSchemas)
      
      // Step 3: If LLM was used, show dialog for validation
      if (inference.needsValidation) {
        setPendingParsedData({ parsedData, agency, fileName: file.name })
        setInferenceResult({ fields: inference.fields, needsValidation: inference.needsValidation })
        setInferenceDialogOpen(true)
        setUploading(false)
        event.target.value = ""
        return
      }

      // If no validation needed, proceed directly
      // Add to unified repository
      addStandardizedData(standardized)

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
    }
  }

  const handleInferenceConfirm = (inferences: FieldInference[]) => {
    if (!pendingParsedData) return

    // Convert inferences to custom mappings
    const customMappings: CustomFieldMapping[] = inferences.map((inf) => ({
      originalField: inf.fieldName,
      canonicalField: inf.suggestedCanonicalField,
      unit: inf.suggestedUnit,
    }))

    // Standardize with custom mappings
    const standardized = standardizeData(
      pendingParsedData.parsedData.rows,
      pendingParsedData.parsedData.headers,
      pendingParsedData.agency,
      customMappings
    )

    // Add to unified repository
    addStandardizedData(standardized)

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

    // Standardize without custom mappings (use rule-based only)
    const standardized = standardizeData(
      pendingParsedData.parsedData.rows,
      pendingParsedData.parsedData.headers,
      pendingParsedData.agency
    )

    // Add to unified repository
    addStandardizedData(standardized)

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
            disabled={uploading}
            className="cursor-pointer"
          />
          {uploading && (
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
                {ds.status === "completed" && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 animate-soft-pulse" />
                )}
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
            >
              {ds.status === "completed" ? "View Details" : "Processing..."}
            </Button>
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
