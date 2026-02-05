/**
 * FITS ingestion types — frontend contract only.
 * Used to render FITS results separately from CSV/dataset repository.
 * No imports from existing ingestion; FITS path is isolated.
 */

export type FITSClassification =
  | "image"
  | "error_map"
  | "low_contrast_image"
  | "spectrum"
  | "light_curve"
  | "table"
  | "unknown"

export interface FITSHDUResult {
  index: number
  type: string
  classification: FITSClassification
  previewImage: string | null
  metadata: Record<string, unknown>
  units: Record<string, string>
}

export type FITSStatus = "success" | "valid_no_visualizable_data" | "error"

export interface FITSResult {
  status?: FITSStatus
  fileName: string
  hdus: FITSHDUResult[]
  warnings?: string[]
  error?: string | null
  message?: string
}
