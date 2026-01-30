"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"
import { StandardizedData, CanonicalField } from "./standardization"

/**
 * Dataset structure - represents one standardized file upload
 */
export interface Dataset {
  id: string
  source: string // filename
  schemaKey: string // deterministic schema hash
  fields: CanonicalField[] // column definitions
  rows: StandardizedData[]
}

interface DataContextType {
  datasets: Dataset[]
  addStandardizedData: (
    rows: StandardizedData[],
    schemaKey: string,
    source: string,
    fields: CanonicalField[]
  ) => void
  clearData: () => void
  // Backward compatibility - flatten all datasets
  unifiedData: StandardizedData[]
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([])

  const addStandardizedData = (
    rows: StandardizedData[],
    schemaKey: string,
    source: string,
    fields: CanonicalField[]
  ) => {
    // DEBUG: Verify data being added
    console.log("addStandardizedData called with:", { rows: rows.length, schemaKey, source, fields })
    
    // Ensure data is valid
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn("addStandardizedData: Invalid rows - not an array or empty")
      return
    }
    if (!schemaKey || !source || !Array.isArray(fields)) {
      console.warn("addStandardizedData: Invalid parameters")
      return
    }
    
    // Capture parameters before setState
    const newRows = Array.isArray(rows) ? rows : []
    const newSchemaKey = schemaKey
    const newSource = source
    const newFields = Array.isArray(fields) ? fields : []
    
    // Immutable state update
    setDatasets((prev) => {
      // Check if dataset with same schemaKey exists
      const existingIndex = prev.findIndex((ds) => ds.schemaKey === newSchemaKey)
      
      if (existingIndex >= 0) {
        // Merge into existing dataset - append rows
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          rows: [...updated[existingIndex].rows, ...newRows],
          // Update source to include new filename (comma-separated)
          source: updated[existingIndex].source.includes(newSource)
            ? updated[existingIndex].source
            : `${updated[existingIndex].source}, ${newSource}`,
        }
        console.log("Merged into existing dataset:", updated[existingIndex].id)
        return updated
      } else {
        // Create new dataset
        const newDataset: Dataset = {
          id: `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: newSource,
          schemaKey: newSchemaKey,
          fields: newFields,
          rows: newRows,
        }
        console.log("Created new dataset:", newDataset.id)
        return [...prev, newDataset]
      }
    })
  }

  const clearData = () => {
    setDatasets([])
  }

  // Backward compatibility - flatten all datasets
  const unifiedData: StandardizedData[] = datasets.flatMap((ds) => ds.rows)

  return (
    <DataContext.Provider value={{ datasets, addStandardizedData, clearData, unifiedData }}>
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

