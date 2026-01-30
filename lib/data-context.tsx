"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

/**
 * Column definition in final dataset
 */
export interface DatasetColumn {
  name: string
  semanticType: string
  unit: string | null
  description: string
}

/**
 * Dataset structure - represents one processed file upload
 * Each upload creates a new dataset (no merging)
 */
export interface Dataset {
  id: string
  name: string
  columns: DatasetColumn[]
  rows: Record<string, number | string | null>[]
  sourceFile: string
  createdAt: string
}

interface DataContextType {
  datasets: Dataset[]
  addDataset: (dataset: Dataset) => void
  clearData: () => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([])

  const addDataset = (dataset: Dataset) => {
    // Validate dataset
    if (
      !dataset.id ||
      !dataset.name ||
      !Array.isArray(dataset.columns) ||
      !Array.isArray(dataset.rows) ||
      !dataset.sourceFile ||
      !dataset.createdAt
    ) {
      console.warn("addDataset: Invalid dataset structure")
      return
    }

    // Each upload creates a new dataset - append immutably (no merging)
    setDatasets((prev) => [...prev, dataset])
  }

  const clearData = () => {
    setDatasets([])
  }

  return (
    <DataContext.Provider value={{ datasets, addDataset, clearData }}>
      {children}
    </DataContext.Provider>
  )
}

export function useDataContext() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useDataContext must be used within a DataProvider")
  }
  return context
}

