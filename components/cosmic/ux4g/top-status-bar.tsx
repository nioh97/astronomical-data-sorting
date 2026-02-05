"use client"

/**
 * UX4G Top Status Bar — system state + file context. User never guesses what the system is doing.
 */

import { Loader2 } from "lucide-react"
import { useAppUI, type AppUIMode, type FileTypeBadge } from "@/lib/app-ui-context"

const MODE_LABELS: Record<AppUIMode, string> = {
  idle: "Idle",
  uploading: "Uploading",
  analyzing: "Analyzing",
  awaiting_units: "Awaiting Units",
  converting: "Converting",
  ready: "Ready",
}

function FileTypeBadgePill({ type }: { type: FileTypeBadge }) {
  if (!type) return null
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700"
      aria-label={`File type: ${type}`}
    >
      {type}
    </span>
  )
}

export default function TopStatusBar() {
  const { mode, fileName, fileType, datasetSize } = useAppUI()
  const busy = mode === "uploading" || mode === "analyzing" || mode === "converting"

  return (
    <div
      className="border-b border-slate-200 bg-slate-100"
      role="status"
      aria-live="polite"
      aria-label={`Status: ${MODE_LABELS[mode]}${fileName ? `, file: ${fileName}` : ""}`}
    >
      <div className="container mx-auto px-4 py-2 max-w-7xl flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium text-slate-700">Mode:</span>
        <span className="text-slate-800">{MODE_LABELS[mode]}</span>
        {busy && (
          <span className="flex items-center gap-1 text-slate-600" aria-hidden>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Working…</span>
          </span>
        )}
        {fileName && (
          <>
            <span className="text-slate-400">|</span>
            <span className="text-slate-700 truncate max-w-[200px]" title={fileName}>
              {fileName}
            </span>
            {fileType && <FileTypeBadgePill type={fileType} />}
            {datasetSize && (
              <span className="text-slate-500" title="Dataset size">
                {datasetSize}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
