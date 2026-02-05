"use client"

/**
 * UX4G Stage Navigator — read-only vertical stage tracker. No click-to-skip.
 */

import { Check, Circle } from "lucide-react"
import { useAppUI, type AppUIStage } from "@/lib/app-ui-context"

const STAGES: { id: AppUIStage; label: string; csvOnly?: boolean }[] = [
  { id: "upload", label: "Upload" },
  { id: "analyze", label: "Analyze Structure" },
  { id: "units", label: "Select Units (CSV only)", csvOnly: true },
  { id: "convert", label: "Convert & Normalize" },
  { id: "repository", label: "Repository" },
  { id: "visualization", label: "Visualization" },
]

const ORDER: AppUIStage[] = ["upload", "analyze", "units", "convert", "repository", "visualization"]

function stageIndex(s: AppUIStage): number {
  const i = ORDER.indexOf(s)
  return i >= 0 ? i : 0
}

export default function StageNavigator() {
  const { currentStage } = useAppUI()
  const currentIdx = stageIndex(currentStage)

  return (
    <nav
      className="w-52 shrink-0 border-r border-slate-200 bg-slate-50/50 p-4"
      aria-label="Pipeline stages"
    >
      <ol className="space-y-1 list-none" role="list">
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isFuture = idx > currentIdx
          return (
            <li
              key={stage.id}
              className="flex items-center gap-2 py-2 px-2 rounded-md text-sm"
              data-stage={stage.id}
              data-current={isCurrent || undefined}
              data-completed={isCompleted || undefined}
            >
              <span
                className="flex shrink-0 items-center justify-center w-5 h-5 rounded-full border border-slate-300"
                aria-hidden
              >
                {isCompleted ? (
                  <Check className="h-3 w-3 text-slate-600" aria-label="Completed" />
                ) : isCurrent ? (
                  <Circle className="h-3 w-3 fill-slate-700 text-slate-700" aria-label="Current" />
                ) : (
                  <Circle className="h-3 w-3 text-slate-300" aria-label="Pending" />
                )}
              </span>
              <span
                className={
                  isCurrent
                    ? "font-medium text-slate-900"
                    : isCompleted
                      ? "text-slate-600"
                      : "text-slate-400"
                }
              >
                {stage.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
