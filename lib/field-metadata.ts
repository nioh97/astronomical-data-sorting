/**
 * Centralized Field Metadata Registry
 * 
 * Contains human-readable descriptions, physical quantities, and units
 * for known astronomical field names (NASA Exoplanet Archive, FITS, etc.)
 * 
 * This registry is the single source of truth for column tooltips.
 * LLM-inferred metadata can be merged but registry definitions take priority.
 */

export interface FieldMetadata {
  /** Human-readable display name */
  displayName: string
  /** Description of what the field represents */
  description: string
  /** Physical quantity (e.g., time, mass, length, count, angle) */
  physicalQuantity?: string
  /** Original/default unit from common sources */
  defaultUnit?: string
  /** Canonical/converted unit if different */
  canonicalUnit?: string
  /** Additional notes (source, caveats, etc.) */
  notes?: string
  /** Known aliases for this field */
  aliases?: string[]
}

/**
 * Registry of known astronomical field metadata.
 * Keys are lowercase canonical field names.
 */
export const FIELD_METADATA: Record<string, FieldMetadata> = {
  // ============================================================================
  // NASA EXOPLANET ARCHIVE - PLANET PROPERTIES
  // ============================================================================
  
  pl_name: {
    displayName: "Planet Name",
    description: "Name of the confirmed exoplanet, typically derived from the host star name with a letter suffix (b, c, d, etc.)",
    physicalQuantity: "identifier",
    notes: "From NASA Exoplanet Archive",
    aliases: ["planet_name", "name", "object_name"],
  },
  
  pl_letter: {
    displayName: "Planet Letter",
    description: "Letter designation of the planet (b, c, d, etc.) indicating order of discovery around the host star",
    physicalQuantity: "identifier",
    notes: "First discovered planet is 'b', second is 'c', etc.",
  },
  
  pl_orbper: {
    displayName: "Orbital Period",
    description: "Time taken by the planet to complete one full orbit around its host star",
    physicalQuantity: "time",
    defaultUnit: "days",
    canonicalUnit: "days",
    notes: "Measured in Earth days. Shorter periods indicate closer orbits.",
    aliases: ["orbital_period", "period", "orbper"],
  },
  
  pl_orbpererr1: {
    displayName: "Orbital Period Upper Error",
    description: "Upper uncertainty bound on the orbital period measurement",
    physicalQuantity: "time",
    defaultUnit: "days",
  },
  
  pl_orbpererr2: {
    displayName: "Orbital Period Lower Error",
    description: "Lower uncertainty bound on the orbital period measurement",
    physicalQuantity: "time",
    defaultUnit: "days",
  },
  
  pl_orbsmax: {
    displayName: "Semi-Major Axis",
    description: "Half of the longest diameter of the planet's elliptical orbit; average distance from the star",
    physicalQuantity: "distance",
    defaultUnit: "AU",
    canonicalUnit: "AU",
    notes: "1 AU = Earth-Sun distance (~149.6 million km)",
    aliases: ["semi_major_axis", "a", "sma"],
  },
  
  pl_rade: {
    displayName: "Planet Radius (Earth)",
    description: "Radius of the planet expressed in Earth radii",
    physicalQuantity: "length",
    defaultUnit: "Earth radii",
    canonicalUnit: "R_Earth",
    notes: "1 Earth radius = 6,371 km",
    aliases: ["radius_earth", "pl_radj"],
  },
  
  pl_radj: {
    displayName: "Planet Radius (Jupiter)",
    description: "Radius of the planet expressed in Jupiter radii",
    physicalQuantity: "length",
    defaultUnit: "Jupiter radii",
    canonicalUnit: "R_Jup",
    notes: "1 Jupiter radius = 69,911 km",
  },
  
  pl_bmasse: {
    displayName: "Planet Mass (Earth)",
    description: "Mass of the planet expressed in Earth masses",
    physicalQuantity: "mass",
    defaultUnit: "Earth masses",
    canonicalUnit: "M_Earth",
    notes: "1 Earth mass = 5.972 × 10²⁴ kg",
    aliases: ["mass_earth", "pl_masse"],
  },
  
  pl_bmassj: {
    displayName: "Planet Mass (Jupiter)",
    description: "Mass of the planet expressed in Jupiter masses",
    physicalQuantity: "mass",
    defaultUnit: "Jupiter masses",
    canonicalUnit: "M_Jup",
    notes: "1 Jupiter mass = 1.898 × 10²⁷ kg",
    aliases: ["mass_jupiter"],
  },
  
  pl_bmassprov: {
    displayName: "Planet Mass Provenance",
    description: "Method used to determine the planet mass (e.g., radial velocity, transit timing)",
    physicalQuantity: "categorical",
  },
  
  pl_orbeccen: {
    displayName: "Orbital Eccentricity",
    description: "Shape of the orbit; 0 = circular, approaching 1 = highly elliptical",
    physicalQuantity: "dimensionless",
    notes: "Ranges from 0 (circular) to <1 (elliptical). Earth's eccentricity is ~0.017.",
    aliases: ["eccentricity", "ecc"],
  },
  
  pl_orbincl: {
    displayName: "Orbital Inclination",
    description: "Angle between the orbital plane and the plane of the sky (90° = edge-on)",
    physicalQuantity: "angle",
    defaultUnit: "degrees",
    notes: "90° means we view the orbit edge-on; required for transit detection",
    aliases: ["inclination", "incl"],
  },
  
  pl_eqt: {
    displayName: "Equilibrium Temperature",
    description: "Theoretical temperature of the planet assuming uniform heat distribution and no atmosphere",
    physicalQuantity: "temperature",
    defaultUnit: "K",
    canonicalUnit: "K",
    notes: "Kelvin scale. Does not account for greenhouse effects.",
    aliases: ["teq", "equilibrium_temp"],
  },
  
  pl_insol: {
    displayName: "Insolation Flux",
    description: "Amount of stellar radiation received by the planet relative to Earth",
    physicalQuantity: "flux",
    defaultUnit: "Earth flux",
    notes: "1.0 = same as Earth receives from the Sun",
    aliases: ["insolation"],
  },
  
  pl_dens: {
    displayName: "Planet Density",
    description: "Average density of the planet",
    physicalQuantity: "density",
    defaultUnit: "g/cm³",
    notes: "Earth density ≈ 5.5 g/cm³; Jupiter ≈ 1.3 g/cm³",
    aliases: ["density"],
  },
  
  pl_trandep: {
    displayName: "Transit Depth",
    description: "Fraction of stellar light blocked during a planetary transit",
    physicalQuantity: "dimensionless",
    defaultUnit: "percent",
    notes: "Deeper transits indicate larger planets relative to star size",
  },
  
  pl_trandur: {
    displayName: "Transit Duration",
    description: "Time from first to last contact during a planetary transit",
    physicalQuantity: "time",
    defaultUnit: "hours",
    aliases: ["transit_duration"],
  },
  
  pl_tranmid: {
    displayName: "Transit Midpoint",
    description: "Time of the center of a planetary transit event",
    physicalQuantity: "time",
    defaultUnit: "BJD",
    notes: "Barycentric Julian Date - time corrected for Earth's motion",
  },
  
  pl_imppar: {
    displayName: "Impact Parameter",
    description: "Projected distance between planet and star center during transit (0 = central, 1 = grazing)",
    physicalQuantity: "dimensionless",
    notes: "0 = planet transits across stellar center; 1 = just grazes the limb",
  },
  
  pl_ratdor: {
    displayName: "Ratio of Distance to Stellar Radius",
    description: "Semi-major axis divided by stellar radius (a/R*)",
    physicalQuantity: "dimensionless",
    notes: "Useful for determining transit geometry",
  },
  
  pl_ratror: {
    displayName: "Ratio of Planet to Stellar Radius",
    description: "Planet radius divided by stellar radius (Rp/R*)",
    physicalQuantity: "dimensionless",
    notes: "Square root of transit depth",
  },

  // ============================================================================
  // NASA EXOPLANET ARCHIVE - STELLAR PROPERTIES
  // ============================================================================
  
  hostname: {
    displayName: "Host Star Name",
    description: "Name of the star around which the planet orbits",
    physicalQuantity: "identifier",
    aliases: ["star_name", "host"],
  },
  
  st_spectype: {
    displayName: "Spectral Type",
    description: "Stellar classification based on temperature and spectral lines (O, B, A, F, G, K, M)",
    physicalQuantity: "categorical",
    notes: "G-type stars like our Sun are yellow; M-type are red dwarfs",
    aliases: ["spectral_type", "spectype"],
  },
  
  st_teff: {
    displayName: "Stellar Effective Temperature",
    description: "Surface temperature of the host star",
    physicalQuantity: "temperature",
    defaultUnit: "K",
    notes: "Sun's effective temperature is ~5778 K",
    aliases: ["teff", "star_temp"],
  },
  
  st_rad: {
    displayName: "Stellar Radius",
    description: "Radius of the host star expressed in solar radii",
    physicalQuantity: "length",
    defaultUnit: "Solar radii",
    canonicalUnit: "R_Sun",
    notes: "1 Solar radius = 696,000 km",
    aliases: ["star_radius"],
  },
  
  st_mass: {
    displayName: "Stellar Mass",
    description: "Mass of the host star expressed in solar masses",
    physicalQuantity: "mass",
    defaultUnit: "Solar masses",
    canonicalUnit: "M_Sun",
    notes: "1 Solar mass = 1.989 × 10³⁰ kg",
    aliases: ["star_mass"],
  },
  
  st_met: {
    displayName: "Stellar Metallicity",
    description: "Abundance of elements heavier than helium relative to the Sun ([Fe/H])",
    physicalQuantity: "dimensionless",
    defaultUnit: "dex",
    notes: "0 = solar metallicity; positive = metal-rich; negative = metal-poor",
    aliases: ["metallicity", "feh"],
  },
  
  st_metratio: {
    displayName: "Metallicity Ratio",
    description: "Element ratio used to determine metallicity (typically Fe/H)",
    physicalQuantity: "categorical",
  },
  
  st_lum: {
    displayName: "Stellar Luminosity",
    description: "Total energy output of the star relative to the Sun",
    physicalQuantity: "luminosity",
    defaultUnit: "Solar luminosities",
    canonicalUnit: "L_Sun",
    notes: "1 Solar luminosity = 3.828 × 10²⁶ W",
    aliases: ["luminosity"],
  },
  
  st_logg: {
    displayName: "Stellar Surface Gravity",
    description: "Logarithm of surface gravitational acceleration (log g)",
    physicalQuantity: "acceleration",
    defaultUnit: "log(cm/s²)",
    notes: "Sun's log g ≈ 4.44. Lower values indicate giant stars.",
    aliases: ["logg", "surface_gravity"],
  },
  
  st_age: {
    displayName: "Stellar Age",
    description: "Estimated age of the host star",
    physicalQuantity: "time",
    defaultUnit: "Gyr",
    notes: "Sun's age is ~4.6 Gyr",
    aliases: ["age"],
  },
  
  st_dens: {
    displayName: "Stellar Density",
    description: "Average density of the host star",
    physicalQuantity: "density",
    defaultUnit: "g/cm³",
    notes: "Sun's density ≈ 1.4 g/cm³",
  },
  
  st_vsin: {
    displayName: "Stellar Rotational Velocity",
    description: "Projected rotational velocity of the star (v sin i)",
    physicalQuantity: "velocity",
    defaultUnit: "km/s",
    notes: "Only measures component along line of sight",
  },
  
  st_rotp: {
    displayName: "Stellar Rotation Period",
    description: "Time for the star to complete one rotation on its axis",
    physicalQuantity: "time",
    defaultUnit: "days",
    notes: "Sun's rotation period is ~25 days at equator",
  },

  // ============================================================================
  // NASA EXOPLANET ARCHIVE - SYSTEM PROPERTIES
  // ============================================================================
  
  sy_snum: {
    displayName: "Number of Stars",
    description: "Total number of stars in the planetary system",
    physicalQuantity: "count",
    notes: "1 = single star system; >1 = binary/multiple star system",
    aliases: ["num_stars"],
  },
  
  sy_pnum: {
    displayName: "Number of Planets",
    description: "Total number of confirmed planets orbiting the host star",
    physicalQuantity: "count",
    notes: "Derived from NASA Exoplanet Archive confirmed planets catalog",
    aliases: ["num_planets", "planet_count"],
  },
  
  sy_mnum: {
    displayName: "Number of Moons",
    description: "Total number of confirmed moons in the system",
    physicalQuantity: "count",
    notes: "Exomoons are extremely difficult to detect; most entries are 0 or unknown",
  },
  
  sy_dist: {
    displayName: "Distance from Earth",
    description: "Distance from our Solar System to the planetary system",
    physicalQuantity: "distance",
    defaultUnit: "parsec",
    canonicalUnit: "pc",
    notes: "1 parsec = 3.26 light-years = 3.086 × 10¹³ km",
    aliases: ["distance", "dist"],
  },
  
  sy_vmag: {
    displayName: "V-band Magnitude",
    description: "Apparent brightness of the system in the visible V-band",
    physicalQuantity: "brightness",
    defaultUnit: "mag",
    notes: "Logarithmic scale; lower = brighter. Naked-eye limit ~6 mag.",
    aliases: ["vmag", "magnitude", "v_mag"],
  },
  
  sy_kmag: {
    displayName: "K-band Magnitude",
    description: "Apparent brightness in the near-infrared K-band (2.2 μm)",
    physicalQuantity: "brightness",
    defaultUnit: "mag",
    notes: "Useful for observing cooler stars and dust-obscured objects",
  },
  
  sy_gaiamag: {
    displayName: "Gaia G Magnitude",
    description: "Apparent brightness in the Gaia satellite's G-band",
    physicalQuantity: "brightness",
    defaultUnit: "mag",
    notes: "From ESA Gaia mission; very precise photometry",
  },
  
  sy_pm: {
    displayName: "Total Proper Motion",
    description: "Rate of angular motion across the sky",
    physicalQuantity: "angular velocity",
    defaultUnit: "mas/yr",
    notes: "milliarcseconds per year; indicates how fast the star moves relative to background",
    aliases: ["proper_motion"],
  },
  
  sy_pmra: {
    displayName: "Proper Motion (RA)",
    description: "Component of proper motion in the Right Ascension direction",
    physicalQuantity: "angular velocity",
    defaultUnit: "mas/yr",
  },
  
  sy_pmdec: {
    displayName: "Proper Motion (Dec)",
    description: "Component of proper motion in the Declination direction",
    physicalQuantity: "angular velocity",
    defaultUnit: "mas/yr",
  },
  
  sy_plx: {
    displayName: "Parallax",
    description: "Angular shift of the star's position due to Earth's orbit; used to measure distance",
    physicalQuantity: "angle",
    defaultUnit: "mas",
    notes: "Distance (pc) = 1000 / parallax (mas)",
    aliases: ["parallax", "plx"],
  },

  // ============================================================================
  // COORDINATES
  // ============================================================================
  
  ra: {
    displayName: "Right Ascension",
    description: "Celestial longitude coordinate; angular distance eastward along the celestial equator from the vernal equinox",
    physicalQuantity: "angle",
    defaultUnit: "degrees",
    canonicalUnit: "deg",
    notes: "Ranges 0-360° or 0-24h. Often displayed in sexagesimal (HH:MM:SS)",
    aliases: ["ra_deg", "raj2000", "ra_j2000", "right_ascension"],
  },
  
  dec: {
    displayName: "Declination",
    description: "Celestial latitude coordinate; angular distance north or south of the celestial equator",
    physicalQuantity: "angle",
    defaultUnit: "degrees",
    canonicalUnit: "deg",
    notes: "Ranges -90° (south pole) to +90° (north pole). Often displayed in sexagesimal (DD:MM:SS)",
    aliases: ["dec_deg", "dej2000", "de_j2000", "declination"],
  },
  
  glat: {
    displayName: "Galactic Latitude",
    description: "Angular distance above or below the Galactic plane",
    physicalQuantity: "angle",
    defaultUnit: "degrees",
    notes: "0° = in the Milky Way plane; ±90° = Galactic poles",
  },
  
  glon: {
    displayName: "Galactic Longitude",
    description: "Angular distance along the Galactic plane from the Galactic center",
    physicalQuantity: "angle",
    defaultUnit: "degrees",
    notes: "0° = toward Galactic center (Sagittarius)",
  },
  
  elat: {
    displayName: "Ecliptic Latitude",
    description: "Angular distance above or below the ecliptic plane",
    physicalQuantity: "angle",
    defaultUnit: "degrees",
  },
  
  elon: {
    displayName: "Ecliptic Longitude",
    description: "Angular distance along the ecliptic from the vernal equinox",
    physicalQuantity: "angle",
    defaultUnit: "degrees",
  },

  // ============================================================================
  // DISCOVERY & OBSERVATION METADATA
  // ============================================================================
  
  disc_year: {
    displayName: "Discovery Year",
    description: "Year when the planet was first confirmed/announced",
    physicalQuantity: "time",
    defaultUnit: "year",
    aliases: ["discovery_year", "year"],
  },
  
  disc_facility: {
    displayName: "Discovery Facility",
    description: "Telescope or observatory where the planet was discovered",
    physicalQuantity: "categorical",
    notes: "e.g., Kepler, TESS, HARPS, Keck",
    aliases: ["facility", "telescope"],
  },
  
  disc_instrument: {
    displayName: "Discovery Instrument",
    description: "Specific instrument used for the discovery observation",
    physicalQuantity: "categorical",
  },
  
  disc_telescope: {
    displayName: "Discovery Telescope",
    description: "Telescope used for the initial discovery",
    physicalQuantity: "categorical",
  },
  
  discoverymethod: {
    displayName: "Discovery Method",
    description: "Technique used to detect the planet",
    physicalQuantity: "categorical",
    notes: "Common methods: Transit, Radial Velocity, Direct Imaging, Microlensing",
    aliases: ["discovery_method", "method"],
  },
  
  disc_refname: {
    displayName: "Discovery Reference",
    description: "Citation to the discovery publication",
    physicalQuantity: "identifier",
  },
  
  disc_pubdate: {
    displayName: "Discovery Publication Date",
    description: "Date when the discovery was published",
    physicalQuantity: "time",
    defaultUnit: "date",
  },
  
  rowupdate: {
    displayName: "Last Row Update",
    description: "Date when this data row was last modified in the source catalog",
    physicalQuantity: "time",
    defaultUnit: "date",
  },
  
  releasedate: {
    displayName: "Release Date",
    description: "Date when this data was released to the public",
    physicalQuantity: "time",
    defaultUnit: "date",
  },

  // ============================================================================
  // FLAGS & STATUS
  // ============================================================================
  
  pl_controv_flag: {
    displayName: "Controversial Flag",
    description: "Indicates if the planet's existence or parameters are disputed",
    physicalQuantity: "boolean",
    notes: "1 = controversial; 0 = not controversial",
  },
  
  pl_refname: {
    displayName: "Planet Reference",
    description: "Citation for the adopted planetary parameters",
    physicalQuantity: "identifier",
  },
  
  st_refname: {
    displayName: "Stellar Reference",
    description: "Citation for the adopted stellar parameters",
    physicalQuantity: "identifier",
  },
  
  ttv_flag: {
    displayName: "TTV Flag",
    description: "Indicates if Transit Timing Variations have been detected",
    physicalQuantity: "boolean",
    notes: "TTVs can indicate gravitational interactions with other planets",
  },
  
  tran_flag: {
    displayName: "Transit Flag",
    description: "Indicates if the planet has been observed to transit its star",
    physicalQuantity: "boolean",
  },
  
  rv_flag: {
    displayName: "Radial Velocity Flag",
    description: "Indicates if radial velocity measurements exist for this planet",
    physicalQuantity: "boolean",
  },
  
  pul_flag: {
    displayName: "Pulsar Timing Flag",
    description: "Indicates if planet was detected via pulsar timing",
    physicalQuantity: "boolean",
  },
  
  ima_flag: {
    displayName: "Direct Imaging Flag",
    description: "Indicates if the planet has been directly imaged",
    physicalQuantity: "boolean",
  },

  // ============================================================================
  // GENERIC / COMMON FIELDS
  // ============================================================================
  
  id: {
    displayName: "Identifier",
    description: "Unique identifier for this record",
    physicalQuantity: "identifier",
    aliases: ["object_id", "source_id"],
  },
  
  name: {
    displayName: "Name",
    description: "Name or designation of the object",
    physicalQuantity: "identifier",
    aliases: ["object_name", "designation"],
  },
  
  distance: {
    displayName: "Distance",
    description: "Distance to the object",
    physicalQuantity: "distance",
    aliases: ["dist", "d"],
  },
  
  distance_pc: {
    displayName: "Distance (Parsecs)",
    description: "Distance to the object in parsecs",
    physicalQuantity: "distance",
    defaultUnit: "pc",
    canonicalUnit: "pc",
  },
  
  distance_ly: {
    displayName: "Distance (Light Years)",
    description: "Distance to the object in light years",
    physicalQuantity: "distance",
    defaultUnit: "ly",
  },
  
  distance_km: {
    displayName: "Distance (Kilometers)",
    description: "Distance to the object in kilometers",
    physicalQuantity: "distance",
    defaultUnit: "km",
  },
  
  magnitude: {
    displayName: "Magnitude",
    description: "Apparent brightness on the astronomical magnitude scale",
    physicalQuantity: "brightness",
    defaultUnit: "mag",
    notes: "Logarithmic scale; lower values = brighter objects",
    aliases: ["mag", "vmag", "brightness"],
  },
  
  mass: {
    displayName: "Mass",
    description: "Mass of the object",
    physicalQuantity: "mass",
    aliases: ["m"],
  },
  
  radius: {
    displayName: "Radius",
    description: "Radius of the object",
    physicalQuantity: "length",
    aliases: ["r", "rad"],
  },
  
  temperature: {
    displayName: "Temperature",
    description: "Temperature of the object",
    physicalQuantity: "temperature",
    defaultUnit: "K",
    aliases: ["temp", "teff"],
  },
  
  period: {
    displayName: "Period",
    description: "Orbital or rotational period",
    physicalQuantity: "time",
    aliases: ["p", "orbper"],
  },
  
  velocity: {
    displayName: "Velocity",
    description: "Speed of the object",
    physicalQuantity: "velocity",
    aliases: ["vel", "v"],
  },
  
  flux: {
    displayName: "Flux",
    description: "Energy received per unit area per unit time",
    physicalQuantity: "flux",
    aliases: ["f"],
  },
  
  time: {
    displayName: "Time",
    description: "Time or timestamp of observation",
    physicalQuantity: "time",
    aliases: ["t", "date", "epoch"],
  },
  
  jd: {
    displayName: "Julian Date",
    description: "Continuous count of days since January 1, 4713 BC",
    physicalQuantity: "time",
    defaultUnit: "JD",
    notes: "JD 2451545.0 = January 1, 2000, 12:00 TT",
    aliases: ["julian_date"],
  },
  
  mjd: {
    displayName: "Modified Julian Date",
    description: "Julian Date minus 2400000.5 days",
    physicalQuantity: "time",
    defaultUnit: "MJD",
    notes: "MJD = JD - 2400000.5; MJD 0 = November 17, 1858",
    aliases: ["modified_julian_date"],
  },
  
  bjd: {
    displayName: "Barycentric Julian Date",
    description: "Julian Date corrected to the Solar System barycenter",
    physicalQuantity: "time",
    defaultUnit: "BJD",
    notes: "Removes light travel time effects from Earth's orbital motion",
  },
  
  hjd: {
    displayName: "Heliocentric Julian Date",
    description: "Julian Date corrected to the center of the Sun",
    physicalQuantity: "time",
    defaultUnit: "HJD",
    notes: "Older standard; BJD is now preferred",
  },
}

/**
 * Get metadata for a field by name or alias.
 * Performs case-insensitive lookup and checks aliases.
 */
export function getFieldMetadata(fieldName: string): FieldMetadata | null {
  const normalizedName = fieldName.toLowerCase().trim()
  
  // Direct lookup
  if (FIELD_METADATA[normalizedName]) {
    return FIELD_METADATA[normalizedName]
  }
  
  // Search aliases
  for (const [key, metadata] of Object.entries(FIELD_METADATA)) {
    if (metadata.aliases?.some(alias => alias.toLowerCase() === normalizedName)) {
      return metadata
    }
  }
  
  return null
}

/**
 * Merge LLM-inferred metadata with registry metadata.
 * Registry definitions take priority.
 */
export function mergeFieldMetadata(
  fieldName: string,
  llmMetadata?: Partial<FieldMetadata>
): FieldMetadata {
  const registryMetadata = getFieldMetadata(fieldName)
  
  // If no registry metadata, use LLM metadata or create default
  if (!registryMetadata) {
    return {
      displayName: llmMetadata?.displayName || formatFieldName(fieldName),
      description: llmMetadata?.description || "No description available",
      physicalQuantity: llmMetadata?.physicalQuantity,
      defaultUnit: llmMetadata?.defaultUnit,
      canonicalUnit: llmMetadata?.canonicalUnit,
      notes: llmMetadata?.notes,
    }
  }
  
  // Registry takes priority, fill gaps with LLM metadata
  return {
    displayName: registryMetadata.displayName,
    description: registryMetadata.description,
    physicalQuantity: registryMetadata.physicalQuantity || llmMetadata?.physicalQuantity,
    defaultUnit: registryMetadata.defaultUnit || llmMetadata?.defaultUnit,
    canonicalUnit: registryMetadata.canonicalUnit || llmMetadata?.canonicalUnit,
    notes: registryMetadata.notes || llmMetadata?.notes,
    aliases: registryMetadata.aliases,
  }
}

/**
 * Format a raw field name into a human-readable form.
 */
export function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

/**
 * Get a short description (first sentence) for tooltip preview.
 */
export function getShortDescription(metadata: FieldMetadata): string {
  const desc = metadata.description
  const firstSentence = desc.split(/[.!?]/)[0]
  return firstSentence.length < 100 ? firstSentence : firstSentence.substring(0, 97) + "..."
}
