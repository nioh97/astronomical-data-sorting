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

/** 
 * Deterministic conversion factors for unit conversion. 
 * Key: "fromUnit_toUnit" (normalized lower, spaces→underscores).
 * COMPLETE COVERAGE for all UNIT_TAXONOMY quantities.
 */
export const CONVERSION_FACTORS: Record<string, (v: number) => number> = {
  // ===================== TIME =====================
  // second ↔ minute ↔ hour ↔ day ↔ year (complete mesh)
  
  // second ↔ minute
  second_min: (v) => v / 60,
  min_second: (v) => v * 60,
  second_minute: (v) => v / 60,
  minute_second: (v) => v * 60,
  s_min: (v) => v / 60,
  min_s: (v) => v * 60,
  sec_min: (v) => v / 60,
  min_sec: (v) => v * 60,
  
  // second ↔ hour
  second_hour: (v) => v / 3600,
  hour_second: (v) => v * 3600,
  second_h: (v) => v / 3600,
  h_second: (v) => v * 3600,
  s_hour: (v) => v / 3600,
  hour_s: (v) => v * 3600,
  sec_hour: (v) => v / 3600,
  hour_sec: (v) => v * 3600,
  
  // second ↔ day
  second_day: (v) => v / 86400,
  day_second: (v) => v * 86400,
  second_d: (v) => v / 86400,
  d_second: (v) => v * 86400,
  s_day: (v) => v / 86400,
  day_s: (v) => v * 86400,
  sec_day: (v) => v / 86400,
  day_sec: (v) => v * 86400,
  
  // second ↔ year
  second_year: (v) => v / (365.25 * 86400),
  year_second: (v) => v * 365.25 * 86400,
  second_yr: (v) => v / (365.25 * 86400),
  yr_second: (v) => v * 365.25 * 86400,
  s_year: (v) => v / (365.25 * 86400),
  year_s: (v) => v * 365.25 * 86400,
  sec_year: (v) => v / (365.25 * 86400),
  year_sec: (v) => v * 365.25 * 86400,
  
  // minute ↔ hour
  min_hour: (v) => v / 60,
  hour_min: (v) => v * 60,
  minute_hour: (v) => v / 60,
  hour_minute: (v) => v * 60,
  min_h: (v) => v / 60,
  h_min: (v) => v * 60,
  
  // minute ↔ day
  min_day: (v) => v / 1440,
  day_min: (v) => v * 1440,
  minute_day: (v) => v / 1440,
  day_minute: (v) => v * 1440,
  min_d: (v) => v / 1440,
  d_min: (v) => v * 1440,
  
  // minute ↔ year
  min_year: (v) => v / (365.25 * 1440),
  year_min: (v) => v * 365.25 * 1440,
  minute_year: (v) => v / (365.25 * 1440),
  year_minute: (v) => v * 365.25 * 1440,
  min_yr: (v) => v / (365.25 * 1440),
  yr_min: (v) => v * 365.25 * 1440,
  
  // hour ↔ day
  hour_day: (v) => v / 24,
  day_hour: (v) => v * 24,
  h_day: (v) => v / 24,
  day_h: (v) => v * 24,
  h_d: (v) => v / 24,
  d_h: (v) => v * 24,
  
  // hour ↔ year
  hour_year: (v) => v / (365.25 * 24),
  year_hour: (v) => v * 365.25 * 24,
  hour_yr: (v) => v / (365.25 * 24),
  yr_hour: (v) => v * 365.25 * 24,
  h_year: (v) => v / (365.25 * 24),
  year_h: (v) => v * 365.25 * 24,
  
  // day ↔ year
  day_year: (v) => v / 365.25,
  year_day: (v) => v * 365.25,
  day_yr: (v) => v / 365.25,
  yr_day: (v) => v * 365.25,
  d_year: (v) => v / 365.25,
  year_d: (v) => v * 365.25,
  d_yr: (v) => v / 365.25,
  yr_d: (v) => v * 365.25,
  days_yr: (v) => v / 365.25,
  yr_days: (v) => v * 365.25,
  
  // identity aliases
  d_day: (v) => v,
  day_d: (v) => v,
  h_hour: (v) => v,
  hour_h: (v) => v,
  min_minute: (v) => v,
  minute_min: (v) => v,
  s_second: (v) => v,
  second_s: (v) => v,
  sec_second: (v) => v,
  second_sec: (v) => v,

  // ===================== LENGTH =====================
  // meter ↔ km
  meter_km: (v) => v / 1000,
  km_meter: (v) => v * 1000,
  m_km: (v) => v / 1000,
  km_m: (v) => v * 1000,
  // meter ↔ AU (1 AU = 149,597,870.7 km)
  meter_au: (v) => v / 149597870700,
  au_meter: (v) => v * 149597870700,
  m_au: (v) => v / 149597870700,
  au_m: (v) => v * 149597870700,
  // km ↔ AU
  km_au: (v) => v / 149597870.7,
  au_km: (v) => v * 149597870.7,
  // Earth radius (6371 km)
  earth_radius_meter: (v) => v * 6371000,
  earth_radius_m: (v) => v * 6371000,
  meter_earth_radius: (v) => v / 6371000,
  m_earth_radius: (v) => v / 6371000,
  earth_radius_km: (v) => v * 6371,
  km_earth_radius: (v) => v / 6371,
  earth_radius_au: (v) => (v * 6371) / 149597870.7,
  au_earth_radius: (v) => (v * 149597870.7) / 6371,
  // Jupiter radius (69911 km)
  jupiter_radius_meter: (v) => v * 69911000,
  jupiter_radius_m: (v) => v * 69911000,
  meter_jupiter_radius: (v) => v / 69911000,
  m_jupiter_radius: (v) => v / 69911000,
  jupiter_radius_km: (v) => v * 69911,
  km_jupiter_radius: (v) => v / 69911,
  jupiter_radius_au: (v) => (v * 69911) / 149597870.7,
  au_jupiter_radius: (v) => (v * 149597870.7) / 69911,
  // Solar radius (696000 km)
  solar_radius_meter: (v) => v * 696000000,
  solar_radius_m: (v) => v * 696000000,
  meter_solar_radius: (v) => v / 696000000,
  m_solar_radius: (v) => v / 696000000,
  solar_radius_km: (v) => v * 696000,
  km_solar_radius: (v) => v / 696000,
  solar_radius_au: (v) => (v * 696000) / 149597870.7,
  au_solar_radius: (v) => (v * 149597870.7) / 696000,
  // Earth ↔ Jupiter radius
  earth_radius_jupiter_radius: (v) => (v * 6371) / 69911,
  jupiter_radius_earth_radius: (v) => (v * 69911) / 6371,
  // Earth ↔ Solar radius
  earth_radius_solar_radius: (v) => (v * 6371) / 696000,
  solar_radius_earth_radius: (v) => (v * 696000) / 6371,
  // Jupiter ↔ Solar radius
  jupiter_radius_solar_radius: (v) => (v * 69911) / 696000,
  solar_radius_jupiter_radius: (v) => (v * 696000) / 69911,

  // ===================== MASS =====================
  // Earth mass (5.972e24 kg)
  earth_mass_kg: (v) => v * 5.972e24,
  kg_earth_mass: (v) => v / 5.972e24,
  // Jupiter mass (1.898e27 kg)
  jupiter_mass_kg: (v) => v * 1.898e27,
  kg_jupiter_mass: (v) => v / 1.898e27,
  // Solar mass (1.989e30 kg)
  solar_mass_kg: (v) => v * 1.989e30,
  kg_solar_mass: (v) => v / 1.989e30,
  m_sun_kg: (v) => v * 1.989e30,
  kg_m_sun: (v) => v / 1.989e30,
  m_earth_kg: (v) => v * 5.972e24,
  kg_m_earth: (v) => v / 5.972e24,
  m_jupiter_kg: (v) => v * 1.898e27,
  kg_m_jupiter: (v) => v / 1.898e27,
  // Earth ↔ Jupiter mass
  earth_mass_jupiter_mass: (v) => (v * 5.972e24) / 1.898e27,
  jupiter_mass_earth_mass: (v) => (v * 1.898e27) / 5.972e24,
  // Earth ↔ Solar mass
  earth_mass_solar_mass: (v) => (v * 5.972e24) / 1.989e30,
  solar_mass_earth_mass: (v) => (v * 1.989e30) / 5.972e24,
  // Jupiter ↔ Solar mass
  jupiter_mass_solar_mass: (v) => (v * 1.898e27) / 1.989e30,
  solar_mass_jupiter_mass: (v) => (v * 1.989e30) / 1.898e27,

  // ===================== DISTANCE (astronomical) =====================
  // parsec (1 pc = 3.085677581e13 km)
  pc_meter: (v) => v * 3.085677581e16,
  meter_pc: (v) => v / 3.085677581e16,
  pc_m: (v) => v * 3.085677581e16,
  m_pc: (v) => v / 3.085677581e16,
  pc_km: (v) => v * 3.085677581e13,
  km_pc: (v) => v / 3.085677581e13,
  pc_au: (v) => v * 206265, // 1 pc ≈ 206265 AU
  au_pc: (v) => v / 206265,
  // kiloparsec
  kpc_pc: (v) => v * 1000,
  pc_kpc: (v) => v / 1000,
  kpc_meter: (v) => v * 3.085677581e19,
  meter_kpc: (v) => v / 3.085677581e19,
  kpc_au: (v) => v * 206265000,
  au_kpc: (v) => v / 206265000,
  // light-year (1 ly = 9.461e12 km)
  ly_meter: (v) => v * 9.461e15,
  meter_ly: (v) => v / 9.461e15,
  ly_km: (v) => v * 9.461e12,
  km_ly: (v) => v / 9.461e12,
  ly_au: (v) => v * 63241, // 1 ly ≈ 63241 AU
  au_ly: (v) => v / 63241,
  ly_pc: (v) => v / 3.262, // 1 pc ≈ 3.262 ly
  pc_ly: (v) => v * 3.262,

  // ===================== ANGLE =====================
  // degree ↔ radian (canonical = "rad")
  degree_rad: (v) => v * (Math.PI / 180),
  rad_degree: (v) => v * (180 / Math.PI),
  degree_radian: (v) => v * (Math.PI / 180),
  radian_degree: (v) => v * (180 / Math.PI),
  deg_rad: (v) => v * (Math.PI / 180),
  rad_deg: (v) => v * (180 / Math.PI),
  // arcminute, arcsecond → degree
  degree_arcmin: (v) => v * 60,
  arcmin_degree: (v) => v / 60,
  degree_arcsec: (v) => v * 3600,
  arcsec_degree: (v) => v / 3600,
  arcmin_arcsec: (v) => v * 60,
  arcsec_arcmin: (v) => v / 60,
  // arcminute, arcsecond → rad (canonical)
  arcmin_rad: (v) => (v / 60) * (Math.PI / 180),
  rad_arcmin: (v) => v * (180 / Math.PI) * 60,
  arcsec_rad: (v) => (v / 3600) * (Math.PI / 180),
  rad_arcsec: (v) => v * (180 / Math.PI) * 3600,
  // Legacy keys (radian spelled out)
  radian_arcmin: (v) => v * (180 / Math.PI) * 60,
  arcmin_radian: (v) => (v / 60) * (Math.PI / 180),
  radian_arcsec: (v) => v * (180 / Math.PI) * 3600,
  arcsec_radian: (v) => (v / 3600) * (Math.PI / 180),

  // ===================== TEMPERATURE =====================
  kelvin_c: (v) => v - 273.15,
  c_kelvin: (v) => v + 273.15,
  kelvin_celsius: (v) => v - 273.15,
  celsius_kelvin: (v) => v + 273.15,
  k_c: (v) => v - 273.15,
  c_k: (v) => v + 273.15,

  // ===================== ACCELERATION =====================
  "m/s^2_cm/s^2": (v) => v * 100,
  "cm/s^2_m/s^2": (v) => v / 100,

  // ===================== VELOCITY =====================
  "m/s_km/s": (v) => v / 1000,
  "km/s_m/s": (v) => v * 1000,

  // ===================== FREQUENCY =====================
  hz_khz: (v) => v / 1000,
  khz_hz: (v) => v * 1000,
  hz_mhz: (v) => v / 1e6,
  mhz_hz: (v) => v * 1e6,
  hz_ghz: (v) => v / 1e9,
  ghz_hz: (v) => v * 1e9,
  khz_mhz: (v) => v / 1000,
  mhz_khz: (v) => v * 1000,
  mhz_ghz: (v) => v / 1000,
  ghz_mhz: (v) => v * 1000,
}

export function factorKey(from: string, to: string): string {
  return `${String(from).trim().toLowerCase().replace(/\s+/g, "_")}_${String(to).trim().toLowerCase().replace(/\s+/g, "_")}`
}

/** Field definition for applyUnitConversions: name, units, and conversion guard. */
export interface FieldDefinition {
  name: string
  unitRequired?: boolean
  finalUnit?: string | null
  originalUnit?: string | null
  physicalQuantity?: string
  timeKind?: "quantity" | "calendar"
}

/**
 * Single source of truth for applying unit conversions to rows.
 * Returns new rows; does not mutate the original row objects.
 */
export function applyUnitConversions(
  rows: Record<string, any>[],
  fields: FieldDefinition[]
): Record<string, any>[] {
  return rows.map((row) => {
    const newRow = { ...row }

    for (const field of fields) {
      if (field.unitRequired !== true) {
        if (process.env.NODE_ENV === "development" && field.finalUnit && field.originalUnit) {
          console.debug(`applyUnitConversions: skipped ${field.name} (unitRequired=false)`)
        }
        continue
      }
      if (!field.finalUnit || field.finalUnit === "ISO_DATE") {
        if (process.env.NODE_ENV === "development" && field.originalUnit) {
          console.debug(`applyUnitConversions: skipped ${field.name} (no finalUnit or ISO_DATE)`)
        }
        continue
      }
      if (field.timeKind === "calendar") {
        if (process.env.NODE_ENV === "development") {
          console.debug(`applyUnitConversions: skipped ${field.name} (calendar time)`)
        }
        continue
      }

      const value = row[field.name]
      if (value === null || value === undefined) continue
      const num = typeof value === "number" ? value : parseFloat(String(value))
      if (Number.isNaN(num)) continue

      const fromUnit = field.originalUnit ?? ""
      const toUnit = field.finalUnit
      if (!fromUnit || !toUnit) {
        if (process.env.NODE_ENV === "development") {
          console.debug(`applyUnitConversions: skipped ${field.name} (missing fromUnit or toUnit)`)
        }
        continue
      }
      if (fromUnit === toUnit) {
        if (process.env.NODE_ENV === "development") {
          console.debug(`applyUnitConversions: skipped ${field.name} (same unit ${fromUnit})`)
        }
        continue
      }

      const converted = applyConversionFactor(num, fromUnit, toUnit)
      if (converted !== null) {
        newRow[field.name] = converted
        if (process.env.NODE_ENV === "development") {
          console.debug(`Converted ${field.name}: ${fromUnit} → ${toUnit} (sample: ${num} → ${converted})`)
        }
      } else if (process.env.NODE_ENV === "development") {
        console.debug(`applyUnitConversions: no factor for ${field.name} (${fromUnit} → ${toUnit}), value unchanged`)
      }
    }

    return newRow
  })
}

/**
 * Returns true if at least one convertible field had fromUnit !== toUnit and at least one value changed.
 * Used to enforce conversion-before-save invariant. Checks first N rows to allow for nulls in row 0.
 */
export function didConversionApply(
  originalRows: Record<string, any>[],
  convertedRows: Record<string, any>[],
  fields: FieldDefinition[]
): boolean {
  if (originalRows.length === 0 || convertedRows.length === 0) return false
  const maxRows = Math.min(originalRows.length, convertedRows.length, 50)
  for (const field of fields) {
    if (field.unitRequired !== true || !field.finalUnit || field.finalUnit === "ISO_DATE" || field.timeKind === "calendar")
      continue
    const fromUnit = (field.originalUnit ?? "").trim().toLowerCase()
    const toUnit = (field.finalUnit ?? "").trim().toLowerCase()
    if (!fromUnit || !toUnit || fromUnit === toUnit) continue
    for (let r = 0; r < maxRows; r++) {
      const orig = originalRows[r][field.name]
      const conv = convertedRows[r][field.name]
      if (orig === null || orig === undefined || conv === null || conv === undefined) continue
      const o = typeof orig === "number" ? orig : parseFloat(String(orig))
      const c = typeof conv === "number" ? conv : parseFloat(String(conv))
      if (Number.isNaN(o) || Number.isNaN(c)) continue
      if (o !== c) return true
    }
  }
  return false
}

/**
 * Apply deterministic conversion by factor. Returns null if no factor exists (caller should log and skip field).
 */
export function applyConversionFactor(
  value: number | string | null,
  fromUnit: string,
  toUnit: string
): number | null {
  if (value === null || value === undefined || value === "") return null
  const num = typeof value === "number" ? value : parseFloat(String(value))
  if (Number.isNaN(num)) return null
  if (fromUnit === toUnit) return num
  const key = factorKey(fromUnit, toUnit)
  const fn = CONVERSION_FACTORS[key]
  if (!fn) return null
  return fn(num)
}

