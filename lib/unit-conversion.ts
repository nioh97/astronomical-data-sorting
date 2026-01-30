/**
 * Deterministic Unit Conversion Engine
 * 
 * Pure functions for unit conversion - NO AI, NO heuristics.
 * Fully deterministic conversions based on semantic type.
 */

export type SemanticType =
  | "right_ascension"
  | "declination"
  | "angular_distance"
  | "distance"
  | "brightness"
  | "color_index"
  | "object_id"
  | "object_type"
  | "observation_time"
  | "other"

export type Unit = string

/**
 * Convert a single value from one unit to another
 */
export function convertValue(
  value: number | string | null,
  fromUnit: Unit | null,
  toUnit: Unit | null,
  semanticType: SemanticType
): number | string | null {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === "") {
    return null
  }

  // Handle special detected unit cases
  if (fromUnit === "none" || fromUnit === "unknown" || fromUnit === "formatted") {
    // For unitless fields or unknown/formatted units, try to parse as number
    if (typeof value === "string") {
      const numValue = parseFloat(value)
      return isNaN(numValue) ? value : numValue
    }
    return typeof value === "number" ? value : String(value)
  }

  // If no units or same unit, return as-is (with type conversion)
  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    if (typeof value === "string") {
      const numValue = parseFloat(value)
      return isNaN(numValue) ? value : numValue
    }
    return typeof value === "number" ? value : String(value)
  }

  // Convert to number for numeric conversions
  const numValue = typeof value === "number" ? value : parseFloat(String(value))
  if (isNaN(numValue)) {
    return String(value) // Can't convert, return as string
  }

  // Perform conversion based on semantic type
  switch (semanticType) {
    case "right_ascension":
      return convertRightAscension(numValue, fromUnit, toUnit)

    case "declination":
      return convertDeclination(numValue, fromUnit, toUnit)

    case "angular_distance":
      return convertAngularDistance(numValue, fromUnit, toUnit)

    case "distance":
      return convertDistance(numValue, fromUnit, toUnit)

    case "brightness":
    case "color_index":
      // No conversion - passthrough
      return numValue

    case "object_id":
    case "object_type":
    case "observation_time":
    case "other":
      // No conversion - return as string
      return String(value)

    default:
      return numValue
  }
}

/**
 * Convert right ascension: deg ↔ rad ↔ hour_angle
 */
function convertRightAscension(value: number, fromUnit: Unit, toUnit: Unit): number {
  // Convert to degrees first
  let inDegrees = value
  if (fromUnit === "rad") {
    inDegrees = value * (180 / Math.PI)
  } else if (fromUnit === "hour_angle") {
    inDegrees = value * 15 // 1 hour = 15 degrees
  } else if (fromUnit !== "deg") {
    return value // Unknown unit, return as-is
  }

  // Convert from degrees to target
  if (toUnit === "rad") {
    return inDegrees * (Math.PI / 180)
  } else if (toUnit === "hour_angle") {
    return inDegrees / 15
  } else if (toUnit === "deg") {
    return inDegrees
  }

  return value
}

/**
 * Convert declination: deg ↔ rad
 */
function convertDeclination(value: number, fromUnit: Unit, toUnit: Unit): number {
  // Convert to degrees first
  let inDegrees = value
  if (fromUnit === "rad") {
    inDegrees = value * (180 / Math.PI)
  } else if (fromUnit !== "deg") {
    return value
  }

  // Convert from degrees to target
  if (toUnit === "rad") {
    return inDegrees * (Math.PI / 180)
  } else if (toUnit === "deg") {
    return inDegrees
  }

  return value
}

/**
 * Convert angular distance: deg ↔ arcmin ↔ arcsec
 */
function convertAngularDistance(value: number, fromUnit: Unit, toUnit: Unit): number {
  // Convert to degrees first
  let inDegrees = value
  if (fromUnit === "arcmin") {
    inDegrees = value / 60
  } else if (fromUnit === "arcsec") {
    inDegrees = value / 3600
  } else if (fromUnit !== "deg") {
    return value
  }

  // Convert from degrees to target
  if (toUnit === "arcmin") {
    return inDegrees * 60
  } else if (toUnit === "arcsec") {
    return inDegrees * 3600
  } else if (toUnit === "deg") {
    return inDegrees
  }

  return value
}

/**
 * Convert physical distance: AU ↔ km ↔ parsec ↔ lightyear
 */
function convertDistance(value: number, fromUnit: Unit, toUnit: Unit): number {
  // Convert to km first
  let inKm = value
  if (fromUnit === "AU") {
    inKm = value * 149597870.7 // 1 AU in km
  } else if (fromUnit === "parsec") {
    inKm = value * 3.085677581e13 // 1 pc in km
  } else if (fromUnit === "lightyear") {
    inKm = value * 9.461e12 // 1 ly in km
  } else if (fromUnit !== "km") {
    return value
  }

  // Convert from km to target
  if (toUnit === "AU") {
    return inKm / 149597870.7
  } else if (toUnit === "parsec") {
    return inKm / 3.085677581e13
  } else if (toUnit === "lightyear") {
    return inKm / 9.461e12
  } else if (toUnit === "km") {
    return inKm
  }

  return value
}

/**
 * Convert an entire column of values
 */
export function convertColumn(
  values: (number | string | null)[],
  fromUnit: Unit | null,
  toUnit: Unit | null,
  semanticType: SemanticType
): (number | string | null)[] {
  return values.map((value) => convertValue(value, fromUnit, toUnit, semanticType))
}

