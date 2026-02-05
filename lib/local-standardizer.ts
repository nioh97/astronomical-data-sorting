/**
 * Local Deterministic Data Standardization
 * 
 * Performs all data transformations locally based on LLM-provided schema.
 * No LLM calls - pure deterministic transformations.
 */

import { ColumnSchema } from "./llm-schema-inference"

export interface StandardizationInput {
  rows: Record<string, any>[]
  schema: ColumnSchema[]
}

/**
 * Parse conversion rule text and apply conversion
 */
function applyConversion(value: number, conversionRule?: string): number {
  if (!conversionRule) return value

  // Parse common conversion patterns
  const rule = conversionRule.toLowerCase().trim()

  // Radians to degrees
  if (rule.includes("radian") && rule.includes("degree")) {
    return value * 57.29577951308232 // 180 / Math.PI
  }

  // AU to km
  if (rule.includes("au") && rule.includes("km")) {
    return value * 149597870.7 // 1 AU in km
  }

  // Parsecs to km
  if (rule.includes("parsec") && rule.includes("km")) {
    return value * 3.085677581e13 // 1 pc in km
  }

  // Light years to km
  if ((rule.includes("light") && rule.includes("year")) && rule.includes("km")) {
    return value * 9.461e12 // 1 ly in km
  }

  // Try to extract numeric multiplier from text
  const multiplierMatch = rule.match(/multiply.*?by\s+([\d.e+-]+)/i)
  if (multiplierMatch) {
    const multiplier = parseFloat(multiplierMatch[1])
    if (!isNaN(multiplier)) {
      return value * multiplier
    }
  }

  // If no pattern matches, return original value
  return value
}

/**
 * Convert value to target unit based on schema
 */
function convertToTargetUnit(
  value: any,
  column: ColumnSchema
): number | string | null {
  // Handle null/undefined
  if (value === null || value === undefined || value === "") {
    return null
  }

  // If no conversion needed (same unit or both null)
  if (column.unit === column.targetUnit || (!column.unit && !column.targetUnit)) {
    // Try to convert to number if it's numeric
    if (typeof value === "string") {
      const numValue = parseFloat(value)
      return isNaN(numValue) ? value : numValue
    }
    return typeof value === "number" ? value : String(value)
  }

  // If target unit is null (identifier/categorical), return as string
  if (!column.targetUnit || column.targetUnit === "none") {
    return String(value)
  }

  // Convert to number for unit conversion
  const numValue = typeof value === "number" ? value : parseFloat(String(value))
  if (isNaN(numValue)) {
    // Can't convert, return as string
    return String(value)
  }

  // Apply conversion if needed
  if (column.unit !== column.targetUnit && column.conversionRule) {
    return applyConversion(numValue, column.conversionRule)
  }

  return numValue
}

/**
 * Standardize rows based on LLM-provided schema
 * Performs all transformations locally and deterministically
 */
export function standardizeRows(input: StandardizationInput): Record<string, number | string | null>[] {
  const { rows, schema } = input

  // Create mapping from source field to column schema
  const schemaMap = new Map<string, ColumnSchema>()
  schema.forEach((col) => {
    schemaMap.set(col.sourceField, col)
  })

  // Transform each row
  return rows.map((row) => {
    const standardizedRow: Record<string, number | string | null> = {}

    // Process each column according to schema
    schema.forEach((column) => {
      const sourceValue = row[column.sourceField]
      
      // Use canonical name as the key in standardized row
      const standardizedValue = convertToTargetUnit(sourceValue, column)
      standardizedRow[column.canonicalName] = standardizedValue
    })

    return standardizedRow
  })
}


