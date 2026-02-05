"use client"

/**
 * UX4G App UI context — state for status bar, stage navigator, evidence drawer.
 * UI-only; no ingestion/LLM/FITS logic. Components report mode/stage for display.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

export type AppUIMode =
  | "idle"
  | "uploading"
  | "analyzing"
  | "awaiting_units"
  | "converting"
  | "ready"

export type AppUIStage =
  | "upload"
  | "analyze"
  | "units"
  | "convert"
  | "repository"
  | "visualization"

export type FileTypeBadge = "CSV" | "FITS" | "JSON" | "XML" | null

interface AppUIContextValue {
  mode: AppUIMode
  setMode: (m: AppUIMode) => void
  fileName: string
  setFileName: (s: string) => void
  fileType: FileTypeBadge
  setFileType: (t: FileTypeBadge) => void
  datasetSize: string
  setDatasetSize: (s: string) => void
  currentStage: AppUIStage
  setCurrentStage: (s: AppUIStage) => void
  evidenceDrawerOpen: boolean
  setEvidenceDrawerOpen: (open: boolean) => void
  evidenceContent: Record<string, unknown> | null
  setEvidenceContent: (c: Record<string, unknown> | null) => void
}

const defaultValue: AppUIContextValue = {
  mode: "idle",
  setMode: () => {},
  fileName: "",
  setFileName: () => {},
  fileType: null,
  setFileType: () => {},
  datasetSize: "",
  setDatasetSize: () => {},
  currentStage: "upload",
  setCurrentStage: () => {},
  evidenceDrawerOpen: false,
  setEvidenceDrawerOpen: () => {},
  evidenceContent: null,
  setEvidenceContent: () => {},
}

const AppUIContext = createContext<AppUIContextValue>(defaultValue)

const EVIDENCE_DRAWER_KEY = "ux4g_evidence_drawer_open"

export function AppUIProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppUIMode>("idle")
  const [fileName, setFileName] = useState("")
  const [fileType, setFileType] = useState<FileTypeBadge>(null)
  const [datasetSize, setDatasetSize] = useState("")
  const [currentStage, setCurrentStage] = useState<AppUIStage>("upload")
  const [evidenceDrawerOpen, setEvidenceDrawerOpenState] = useState(false)
  const [evidenceContent, setEvidenceContent] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    try {
      const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(EVIDENCE_DRAWER_KEY) : null
      if (stored === "true") setEvidenceDrawerOpenState(true)
    } catch {
      // ignore
    }
  }, [])

  const setEvidenceDrawerOpen = useCallback((open: boolean) => {
    setEvidenceDrawerOpenState(open)
    try {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(EVIDENCE_DRAWER_KEY, String(open))
    } catch {
      // ignore
    }
  }, [])

  const value: AppUIContextValue = {
    mode,
    setMode,
    fileName,
    setFileName,
    fileType,
    setFileType,
    datasetSize,
    setDatasetSize,
    currentStage,
    setCurrentStage,
    evidenceDrawerOpen,
    setEvidenceDrawerOpen,
    evidenceContent,
    setEvidenceContent,
  }

  return <AppUIContext.Provider value={value}>{children}</AppUIContext.Provider>
}

export function useAppUI() {
  const ctx = useContext(AppUIContext)
  if (!ctx) return defaultValue
  return ctx
}
