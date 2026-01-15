"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { parseFile } from "@/lib/file-parsers"
import { standardizeData } from "@/lib/standardization"
import { useDataContext } from "@/lib/data-context"

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

  const detectAgency = (fileName: string): string => {
    const lower = fileName.toLowerCase()
    if (lower.includes("nasa")) return "NASA"
    if (lower.includes("esa")) return "ESA"
    if (lower.includes("jaxa")) return "JAXA"
    if (lower.includes("gaia")) return "ESA"
    if (lower.includes("hubble") || lower.includes("jwst")) return "NASA"
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

      // Standardize the data
      const standardized = standardizeData(parsedData.rows, parsedData.headers, agency)

      // Add to unified repository
      addStandardizedData(standardized)

      // Create dataset record
      const units = detectUnits(parsedData.headers)
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

  return (
    <section className="space-y-6 bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Multi-Source Data Ingestion</h2>

      <Card className="p-6 border-2 border-dashed border-slate-300 bg-slate-50">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-slate-600" />
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
          <Card key={idx} className="p-6 hover:shadow-md transition-shadow">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-slate-900">{ds.name}</h3>
                {ds.status === "completed" && (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
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
                      className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700 font-mono"
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
                      className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-slate-600 font-mono"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              disabled={ds.status !== "completed"}
            >
              {ds.status === "completed" ? "View Details" : "Processing..."}
            </Button>
          </Card>
        ))}
      </div>
    </section>
  )
}
