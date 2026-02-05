/**
 * Normalize human-facing or UI unit strings to canonical names
 * used by conversion factor keys (e.g. "Earth radius" → "earth_radius").
 * Factor keys use lowercase with underscores.
 */

export const UNIT_ALIASES: Record<string, string> = {
  // TIME
  day: "day",
  days: "day",
  d: "day",
  second: "second",
  seconds: "second",
  sec: "second",
  s: "second",
  year: "year",
  years: "year",
  yr: "year",
  hour: "hour",
  hours: "hour",
  h: "hour",

  // LENGTH - basic (canonical = "m")
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
  m: "m",
  kilometer: "km",
  kilometers: "km",
  kilometre: "km",
  kilometres: "km",
  km: "km",
  
  // LENGTH - astronomical
  AU: "au",
  au: "au",
  "Earth radius": "earth_radius",
  "earth radius": "earth_radius",
  "R_earth": "earth_radius",
  "Rearth": "earth_radius",
  "R_Earth": "earth_radius",
  "r_earth": "earth_radius",
  "Jupiter radius": "jupiter_radius",
  "jupiter radius": "jupiter_radius",
  "R_jup": "jupiter_radius",
  "Rjup": "jupiter_radius",
  "R_Jupiter": "jupiter_radius",
  "r_jupiter": "jupiter_radius",
  "Solar radius": "solar_radius",
  "solar radius": "solar_radius",
  "R_sun": "solar_radius",
  "Rsun": "solar_radius",
  "R_Sol": "solar_radius",
  "r_sun": "solar_radius",

  // MASS
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  gram: "g",
  grams: "g",
  g: "g",
  "Earth mass": "earth_mass",
  "earth mass": "earth_mass",
  "M_earth": "earth_mass",
  "Mearth": "earth_mass",
  "M_Earth": "earth_mass",
  "m_earth": "earth_mass",
  "Jupiter mass": "jupiter_mass",
  "jupiter mass": "jupiter_mass",
  "M_jup": "jupiter_mass",
  "Mjup": "jupiter_mass",
  "M_Jupiter": "jupiter_mass",
  "m_jupiter": "jupiter_mass",
  "Solar mass": "solar_mass",
  "solar mass": "solar_mass",
  "M_sun": "solar_mass",
  "Msun": "solar_mass",
  "M_Sol": "solar_mass",
  "m_sun": "solar_mass",

  // DISTANCE
  pc: "pc",
  parsec: "pc",
  parsecs: "pc",
  kpc: "kpc",
  kiloparsec: "kpc",
  kiloparsecs: "kpc",
  ly: "ly",
  lightyear: "ly",
  lightyears: "ly",
  "light-year": "ly",
  "light year": "ly",

  // ANGLE (canonical = "rad")
  degree: "degree",
  degrees: "degree",
  deg: "degree",
  "°": "degree",
  radian: "rad",
  radians: "rad",
  rad: "rad",
  arcmin: "arcmin",
  arcminute: "arcmin",
  arcminutes: "arcmin",
  "'": "arcmin",
  arcsec: "arcsec",
  arcsecond: "arcsec",
  arcseconds: "arcsec",
  '"': "arcsec",

  // TEMPERATURE (canonical = "kelvin")
  K: "kelvin",
  k: "kelvin",
  kelvin: "kelvin",
  Kelvin: "kelvin",
  C: "c",
  c: "c",
  celsius: "c",
  Celsius: "c",

  // ACCELERATION
  "m/s^2": "m/s^2",
  "m/s²": "m/s^2",
  "cm/s^2": "cm/s^2",
  "cm/s²": "cm/s^2",

  // VELOCITY
  "m/s": "m/s",
  "km/s": "km/s",

  // FREQUENCY
  Hz: "hz",
  hz: "hz",
  hertz: "hz",
  kHz: "khz",
  khz: "khz",
  MHz: "mhz",
  mhz: "mhz",
  GHz: "ghz",
  ghz: "ghz",

  // BRIGHTNESS (no conversion)
  mag: "mag",
  magnitude: "mag",
  magnitudes: "mag",
}

/**
 * Return canonical unit string for conversion factor key lookups.
 * Case-insensitive lookup; returns lowercase with spaces→underscores if no alias.
 */
export function normalizeUnit(unit: string): string {
  if (unit == null || String(unit).trim() === "") return unit
  const key = String(unit).trim()
  // Try exact match first
  if (UNIT_ALIASES[key]) return UNIT_ALIASES[key]
  // Try lowercase match
  const lower = key.toLowerCase()
  if (UNIT_ALIASES[lower]) return UNIT_ALIASES[lower]
  // Fallback: lowercase with spaces→underscores (for factor key format)
  return lower.replace(/\s+/g, "_")
}
