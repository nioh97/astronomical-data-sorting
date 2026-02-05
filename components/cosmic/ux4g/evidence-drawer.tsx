"use client"

/**
 * UX4G Evidence & Metadata Drawer — collapsible bottom panel. Evidence always available, never forced.
 */

import { ChevronDown, ChevronUp } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAppUI } from "@/lib/app-ui-context"

export default function EvidenceDrawer() {
  const { evidenceDrawerOpen, setEvidenceDrawerOpen, evidenceContent } = useAppUI()

  return (
    <Collapsible
      open={evidenceDrawerOpen}
      onOpenChange={setEvidenceDrawerOpen}
      className="border-t border-slate-200 bg-slate-50"
    >
      <CollapsibleTrigger
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
        aria-expanded={evidenceDrawerOpen}
        aria-controls="evidence-drawer-content"
        id="evidence-drawer-trigger"
      >
        <span>Evidence & Metadata</span>
        <span className="flex items-center gap-1" aria-hidden>
          {evidenceDrawerOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent
        id="evidence-drawer-content"
        role="region"
        aria-labelledby="evidence-drawer-trigger"
        className="overflow-auto max-h-64"
      >
        <div className="px-4 py-3 border-t border-slate-200">
          {evidenceContent && Object.keys(evidenceContent).length > 0 ? (
            <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words bg-white p-3 rounded border border-slate-200">
              {JSON.stringify(evidenceContent, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">
              Header metadata, FITS headers, WCS info, unit mappings, and field semantics appear here when available.
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
