import type { QuantityEncoding } from "@/lib/llm-field-analysis"

export const ASTRO_FIELD_OVERRIDES: Record<
  string,
  {
    physicalQuantity: string
    recommendedUnit?: string
    unitRequired: boolean
    /** When "logarithmic" or "sexagesimal", conversion is disabled. */
    encoding?: QuantityEncoding
    /** If true, this is a date field and should NEVER be converted. */
    isDate?: boolean
  }
> = {
  // Planet radius
  pl_rade: { physicalQuantity: "length", recommendedUnit: "Earth radius", unitRequired: true },
  pl_radj: { physicalQuantity: "length", recommendedUnit: "Jupiter radius", unitRequired: true },
  // Planet mass
  pl_bmasse: { physicalQuantity: "mass", recommendedUnit: "Earth mass", unitRequired: true },
  pl_bmassj: { physicalQuantity: "mass", recommendedUnit: "Jupiter mass", unitRequired: true },
  // Stellar mass
  st_mass: { physicalQuantity: "mass", recommendedUnit: "Solar mass", unitRequired: true },
  // Stellar radius
  st_rad: { physicalQuantity: "length", recommendedUnit: "Solar radius", unitRequired: true },
  // Temperature
  pl_eqt: { physicalQuantity: "temperature", recommendedUnit: "K", unitRequired: true },
  st_teff: { physicalQuantity: "temperature", recommendedUnit: "K", unitRequired: true },
  // Orbital parameters
  pl_orbper: { physicalQuantity: "time", recommendedUnit: "day", unitRequired: true },
  pl_orbsmax: { physicalQuantity: "length", recommendedUnit: "AU", unitRequired: true },
  // Dimensionless (NO conversion)
  pl_orbeccen: { physicalQuantity: "dimensionless", unitRequired: false },
  pl_insol: { physicalQuantity: "dimensionless", unitRequired: false },
  pl_ratror: { physicalQuantity: "dimensionless", unitRequired: false },
  pl_ratdor: { physicalQuantity: "dimensionless", unitRequired: false },
  // Logarithmic (NO linear conversion)
  st_logg: { physicalQuantity: "acceleration", recommendedUnit: "log(cm/s²)", unitRequired: false, encoding: "logarithmic" },
  // Angles - numeric
  ra: { physicalQuantity: "angle", recommendedUnit: "degree", unitRequired: true },
  dec: { physicalQuantity: "angle", recommendedUnit: "degree", unitRequired: true },
  // Angles - sexagesimal (NO conversion)
  rastr: { physicalQuantity: "angle", unitRequired: false, encoding: "sexagesimal" },
  decstr: { physicalQuantity: "angle", unitRequired: false, encoding: "sexagesimal" },
  // Distance
  sy_dist: { physicalQuantity: "distance", recommendedUnit: "pc", unitRequired: true },
  // COUNT fields (NEVER require units, NEVER convert)
  sy_snum: { physicalQuantity: "count", unitRequired: false },
  sy_pnum: { physicalQuantity: "count", unitRequired: false },
  sy_mnum: { physicalQuantity: "count", unitRequired: false },
  pl_controv_flag: { physicalQuantity: "count", unitRequired: false },
  // DATE fields (NEVER convert) - encoding: identifier to block conversion
  disc_year: { physicalQuantity: "time", unitRequired: false, encoding: "identifier", isDate: true },
  rowupdate: { physicalQuantity: "dimensionless", unitRequired: false, encoding: "identifier", isDate: true },
  releasedate: { physicalQuantity: "dimensionless", unitRequired: false, encoding: "identifier", isDate: true },
  pl_pubdate: { physicalQuantity: "dimensionless", unitRequired: false, encoding: "identifier", isDate: true },
  // Identifiers
  pl_name: { physicalQuantity: "dimensionless", unitRequired: false, encoding: "identifier" },
  hostname: { physicalQuantity: "dimensionless", unitRequired: false, encoding: "identifier" },
  disc_facility: { physicalQuantity: "dimensionless", unitRequired: false, encoding: "identifier" },
  discoverymethod: { physicalQuantity: "dimensionless", unitRequired: false, encoding: "identifier" },
}
