export interface StandardizedData {
  object_id: string
  object_type: string
  right_ascension_deg: number
  declination_deg: number
  distance_km: number
  brightness: number
  observation_time: string
  source: string
  original_data?: Record<string, any>
}

// Field name mappings - maps common variations to canonical field names
export const FIELD_MAPPINGS: Record<string, string> = {
  // Right Ascension variations
  ra: "right_ascension",
  right_ascension: "right_ascension",
  rightascension: "right_ascension",
  "ra_deg": "right_ascension",
  "ra_degrees": "right_ascension",
  "ra_rad": "right_ascension",
  "ra_radians": "right_ascension",
  "_raj2000": "right_ascension",
  "raj2000": "right_ascension",
  "ra_j2000": "right_ascension",
  // Declination variations
  dec: "declination",
  declination: "declination",
  "dec_deg": "declination",
  "dec_degrees": "declination",
  "dec_rad": "declination",
  "dec_radians": "declination",
  "_dej2000": "declination",
  "dej2000": "declination",
  "dec_j2000": "declination",
  // Distance variations
  dist: "distance",
  distance: "distance",
  parallax: "distance",
  "distance_au": "distance",
  "distance_km": "distance",
  "distance_ly": "distance",
  "distance_parsec": "distance",
  "_r": "distance",
  "r": "distance",
  // Brightness/Magnitude variations
  mag: "brightness",
  magnitude: "brightness",
  brightness: "brightness",
  "apparent_magnitude": "brightness",
  "absolute_magnitude": "brightness",
  "vmag": "brightness",
  "v_mag": "brightness",
  "visual_magnitude": "brightness",
  // Color Index variations
  "b-v": "color_index",
  "b_v": "color_index",
  "u-b": "color_index",
  "u_b": "color_index",
  "color_index": "color_index",
  "colorindex": "color_index",
  // Object type variations
  type: "object_type",
  "object_type": "object_type",
  "obj_type": "object_type",
  "star_type": "object_type",
  "sptype": "object_type",
  "sp_type": "object_type",
  "spectral_type": "object_type",
  // Observation time variations
  "obs_date": "observation_time",
  "observation_time": "observation_time",
  "observation_timestamp": "observation_time",
  "obs_time": "observation_time",
  "date": "observation_time",
  "timestamp": "observation_time",
  // Object ID variations
  id: "object_id",
  "object_id": "object_id",
  "obj_id": "object_id",
  "star_id": "object_id",
  "name": "object_id",
  "hd": "object_id",
  "hr": "object_id",
  "varid": "object_id",
}

// Unit conversion functions
function convertToDegrees(value: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase().trim()
  if (normalizedUnit.includes("rad") || normalizedUnit.includes("radian")) {
    return (value * 180) / Math.PI
  }
  return value // Already in degrees or unknown - assume degrees
}

function convertToKilometers(value: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase().trim()
  if (normalizedUnit.includes("au") || normalizedUnit.includes("astronomical unit")) {
    return value * 149597870.7 // 1 AU = 149,597,870.7 km
  }
  if (normalizedUnit.includes("ly") || normalizedUnit.includes("light year")) {
    return value * 9460730472580.8 // 1 ly = 9,460,730,472,580.8 km
  }
  if (normalizedUnit.includes("pc") || normalizedUnit.includes("parsec")) {
    return value * 30856775814671.9 // 1 pc = 30,856,775,814,671.9 km
  }
  if (normalizedUnit.includes("arcsec") || normalizedUnit.includes("arcsecond")) {
    // Parallax in arcseconds to distance in km
    if (value > 0) {
      const parsecs = 1 / value
      return parsecs * 30856775814671.9
    }
    return 0
  }
  // Assume already in km if unit contains "km" or is empty
  if (normalizedUnit.includes("km") || normalizedUnit === "") {
    return value
  }
  return value // Unknown unit - return as is
}

function normalizeTimestamp(value: any): string {
  if (typeof value === "string") {
    // Try to parse various date formats
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
    return value
  }
  if (typeof value === "number") {
    // Unix timestamp (seconds or milliseconds)
    const date = value > 1000000000000 ? new Date(value) : new Date(value * 1000)
    return date.toISOString()
  }
  return new Date().toISOString() // Default to current time
}

function detectUnit(fieldName: string, value: any, headers: string[]): string {
  const lowerField = fieldName.toLowerCase()
  
  // Check if there's a unit column nearby
  const unitField = headers.find((h) => 
    h.toLowerCase().includes("unit") && 
    (h.toLowerCase().includes(lowerField) || lowerField.includes(h.toLowerCase().split("_unit")[0]))
  )
  
  // Infer from field name
  if (lowerField.includes("ra") || lowerField.includes("right_ascension")) {
    if (lowerField.includes("rad")) return "radians"
    return "degrees"
  }
  if (lowerField.includes("dec") || lowerField.includes("declination")) {
    if (lowerField.includes("rad")) return "radians"
    return "degrees"
  }
  if (lowerField.includes("dist") || lowerField.includes("distance")) {
    if (lowerField.includes("au")) return "AU"
    if (lowerField.includes("ly") || lowerField.includes("light")) return "light years"
    if (lowerField.includes("pc") || lowerField.includes("parsec")) return "parsecs"
    if (lowerField.includes("km")) return "km"
    return "AU" // Default assumption
  }
  if (lowerField.includes("parallax")) {
    return "arcseconds"
  }
  if (lowerField.includes("mag") || lowerField.includes("magnitude") || lowerField.includes("brightness")) {
    return "mag" // Return "mag" instead of "magnitude" for consistency
  }
  if (lowerField.includes("color") || lowerField.includes("b-v") || lowerField.includes("u-b")) {
    return "mag" // Color index is also in magnitudes
  }
  
  return ""
}

export interface CustomFieldMapping {
  originalField: string
  canonicalField: string | null
  unit: string
}

/**
 * Canonical field definition with unit information
 */
export interface CanonicalField {
  name: string
  unit: string
}

/**
 * Standardization result with field definitions
 */
export interface StandardizationResult {
  rows: StandardizedData[]
  fields: CanonicalField[]
  schemaKey: string
}

/**
 * Generate a deterministic schema key from canonical fields
 * Same schema (fields + units) = same key
 */
export function generateSchemaKey(fields: CanonicalField[]): string {
  // Sort fields by name for deterministic ordering
  const sorted = [...fields].sort((a, b) => a.name.localeCompare(b.name))
  // Create signature: "field1:unit1|field2:unit2|..."
  const signature = sorted.map((f) => `${f.name}:${f.unit}`).join("|")
  // Simple hash function (deterministic)
  let hash = 0
  for (let i = 0; i < signature.length; i++) {
    const char = signature.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `schema_${Math.abs(hash).toString(36)}`
}

export function standardizeData(
  rawData: Record<string, any>[],
  headers: string[],
  source: string,
  customMappings?: CustomFieldMapping[]
): StandardizationResult {
  if (rawData.length === 0) {
    return { rows: [], fields: [], schemaKey: "" }
  }

  // Build mapping dictionary from custom mappings
  const customFieldMap: Record<string, { canonicalField: string | null; unit: string }> = {}
  if (customMappings) {
    customMappings.forEach((mapping) => {
      customFieldMap[mapping.originalField] = {
        canonicalField: mapping.canonicalField,
        unit: mapping.unit,
      }
    })
  }

  const standardizedRows = rawData.map((row, index) => {
    const standardized: Partial<StandardizedData> = {
      source,
      original_data: row,
    }

    // Map fields - prioritize custom mappings, then fall back to rule-based
    const mappedFields: Record<string, any> = {}
    const fieldUnits: Record<string, string> = {}
    
    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase().trim()
      
      // Check custom mappings first
      if (customFieldMap[header] || customFieldMap[normalizedHeader]) {
        const mapping = customFieldMap[header] || customFieldMap[normalizedHeader]
        if (mapping.canonicalField) {
          mappedFields[mapping.canonicalField] = row[header]
          fieldUnits[mapping.canonicalField] = mapping.unit
        } else {
          mappedFields[normalizedHeader] = row[header]
        }
      } else {
        // Fall back to rule-based mapping
        const canonicalField = FIELD_MAPPINGS[normalizedHeader]
        if (canonicalField) {
          mappedFields[canonicalField] = row[header]
        } else {
          // Keep original field name
          mappedFields[normalizedHeader] = row[header]
        }
      }
    })

    // Extract and convert values with proper unit handling
    // Right Ascension
    if (mappedFields.right_ascension !== undefined) {
      const value = parseFloat(String(mappedFields.right_ascension))
      if (!isNaN(value)) {
        // Use custom mapping unit if available, otherwise detect from field name
        const unit = fieldUnits.right_ascension || detectUnit("right_ascension", value, headers) || "degrees"
        standardized.right_ascension_deg = convertToDegrees(value, unit)
      }
    }

    // Declination
    if (mappedFields.declination !== undefined) {
      const value = parseFloat(String(mappedFields.declination))
      if (!isNaN(value)) {
        // Use custom mapping unit if available, otherwise detect from field name
        const unit = fieldUnits.declination || detectUnit("declination", value, headers) || "degrees"
        standardized.declination_deg = convertToDegrees(value, unit)
      }
    }

    // Distance
    if (mappedFields.distance !== undefined) {
      const value = parseFloat(String(mappedFields.distance))
      if (!isNaN(value)) {
        // Use custom mapping unit if available, otherwise detect from field name
        const unit = fieldUnits.distance || detectUnit("distance", value, headers) || "AU"
        standardized.distance_km = convertToKilometers(value, unit)
      }
    }

    // Brightness (magnitude - no unit conversion needed, stored as-is)
    if (mappedFields.brightness !== undefined) {
      const value = parseFloat(String(mappedFields.brightness))
      if (!isNaN(value)) {
        standardized.brightness = value
      }
    }

    // Color Index (also stored as brightness/magnitude, but we track it separately if needed)
    // Note: color_index fields are typically stored as brightness values in the standardized format
    if (mappedFields.color_index !== undefined) {
      const value = parseFloat(String(mappedFields.color_index))
      if (!isNaN(value) && standardized.brightness === undefined) {
        // If brightness not already set, use color_index as brightness
        standardized.brightness = value
      }
    }

    // Object Type - check SpType, spectral type, etc.
    standardized.object_type = mappedFields.object_type || 
      row[headers.find((h) => 
        h.toLowerCase().includes("sptype") || 
        h.toLowerCase().includes("sp_type") ||
        h.toLowerCase().includes("spectral_type") ||
        h.toLowerCase().includes("type") || 
        h.toLowerCase().includes("class")
      ) || ""] || "Unknown"

    // Object ID - prioritize Name, HD, HR, VarID, then generic ID fields
    standardized.object_id = mappedFields.object_id || 
      row[headers.find((h) => h.toLowerCase() === "name") || ""] ||
      row[headers.find((h) => h.toLowerCase() === "hd") || ""] ||
      row[headers.find((h) => h.toLowerCase() === "hr") || ""] ||
      row[headers.find((h) => h.toLowerCase() === "varid") || ""] ||
      row[headers.find((h) => h.toLowerCase().includes("id")) || ""] || 
      `OBJ-${String(index + 1).padStart(3, "0")}`
    
    // Convert object_id to string if it's a number
    if (typeof standardized.object_id === 'number') {
      standardized.object_id = String(standardized.object_id)
    }

    // Observation Time
    standardized.observation_time = mappedFields.observation_time 
      ? normalizeTimestamp(mappedFields.observation_time)
      : new Date().toISOString()

    // Fill in defaults for missing required fields
    return {
      object_id: standardized.object_id || `OBJ-${String(index + 1).padStart(3, "0")}`,
      object_type: standardized.object_type || "Unknown",
      right_ascension_deg: standardized.right_ascension_deg ?? 0,
      declination_deg: standardized.declination_deg ?? 0,
      distance_km: standardized.distance_km ?? 0,
      brightness: standardized.brightness ?? 0,
      observation_time: standardized.observation_time || new Date().toISOString(),
      source: standardized.source || "Unknown",
      original_data: standardized.original_data,
    } as StandardizedData
  })

  // Always include common fields that are always present in StandardizedData
  // These are guaranteed to exist after standardization
  const allFields: CanonicalField[] = [
    { name: "object_id", unit: "none" },
    { name: "object_type", unit: "none" },
    { name: "right_ascension_deg", unit: "degrees" },
    { name: "declination_deg", unit: "degrees" },
    { name: "distance_km", unit: "km" },
    { name: "brightness", unit: "mag" },
    { name: "observation_time", unit: "ISO 8601" },
    { name: "source", unit: "none" },
  ]

  // Filter to only include fields that have valid (non-null/non-undefined) values in at least one row
  // Note: Zero is a valid astronomical measurement (e.g., magnitude 0 for Vega, coordinates at 0°)
  const activeFields = allFields.filter((field) => {
    return standardizedRows.some((row) => {
      const value = (row as any)[field.name]
      if (value === null || value === undefined) return false
      if (typeof value === "number") {
        // For numeric fields, include if value exists (0 is valid in astronomy)
        // Check for NaN to exclude invalid numbers
        return !isNaN(value)
      }
      if (typeof value === "string") {
        // For string fields, include if non-empty and not "Unknown"
        return value !== "" && value !== "Unknown"
      }
      return true
    })
  })

  // Generate schema key from active fields
  const schemaKey = generateSchemaKey(activeFields)

  return {
    rows: standardizedRows,
    fields: activeFields,
    schemaKey,
  }
}

