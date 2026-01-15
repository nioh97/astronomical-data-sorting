"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"
import { StandardizedData } from "./standardization"

interface DataContextType {
  unifiedData: StandardizedData[]
  addStandardizedData: (data: StandardizedData[]) => void
  clearData: () => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [unifiedData, setUnifiedData] = useState<StandardizedData[]>([])

  const addStandardizedData = (data: StandardizedData[]) => {
    setUnifiedData((prev) => [...data, ...prev])
  }

  const clearData = () => {
    setUnifiedData([])
  }

  return (
    <DataContext.Provider value={{ unifiedData, addStandardizedData, clearData }}>
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

