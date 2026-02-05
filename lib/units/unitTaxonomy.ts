/**
 * Canonical unit taxonomy — single source of truth.
 * Nothing else invents units. All UI and LLM recommendations must use these.
 * These are the DISPLAY names shown in dropdowns; normalization maps them to conversion keys.
 */
export const UNIT_TAXONOMY: Record<string, string[]> = {
  // Non-convertible
  count: [],
  dimensionless: [],

  // Time units (DISPLAY names → normalized: second, day, year)
  time: ["second", "day", "year"],
  
  // Length units (DISPLAY names → normalized via UNIT_ALIASES)
  length: ["meter", "km", "AU", "Earth radius", "Jupiter radius", "Solar radius"],
  
  // Mass units
  mass: ["kg", "Earth mass", "Jupiter mass", "Solar mass"],
  
  // Distance units (astronomical)
  distance: ["pc", "kpc", "ly", "AU", "meter"],
  
  // Angle units
  angle: ["degree", "radian", "arcmin", "arcsec"],
  
  // Temperature (K = Kelvin)
  temperature: ["K", "C"],
  
  // Brightness (magnitudes - no conversion between magnitudes)
  brightness: ["mag"],
  
  // Acceleration
  acceleration: ["m/s^2", "cm/s^2"],
  
  // Velocity
  velocity: ["m/s", "km/s"],
  
  // Frequency
  frequency: ["Hz", "kHz", "MHz", "GHz"],
}

/** Get all allowed units for a physical quantity. Returns empty array for non-convertible quantities. */
export function getUnitsForQuantity(pq: string | undefined | null): string[] {
  if (!pq) return []
  return UNIT_TAXONOMY[pq] ?? []
}
