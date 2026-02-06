/**
 * Astronomy-Specific Field Heuristics
 * 
 * PRIORITY ORDER (strictly enforced):
 * 1. NEGATIVE GUARDS (highest priority - always lock)
 * 2. GAIA DOMAIN OVERRIDES
 * 3. NAME-BASED HEURISTICS
 * 4. Value inference (only if name agrees)
 * 5. LLM (advisory only)
 */

export type PhysicalQuantity =
  | 'angle' | 'length' | 'distance' | 'velocity' | 'time'
  | 'brightness' | 'flux' | 'temperature' | 'mass'
  | 'frequency' | 'count' | 'dimensionless'

export type QuantityEncoding =
  | 'linear' | 'logarithmic' | 'sexagesimal' | 'categorical' | 'identifier'

/** Inference source for UI transparency */
export type InferenceSource = 'guard' | 'domain' | 'name' | 'value' | 'llm' | 'fallback'

export interface HeuristicMatch {
  physicalQuantity: PhysicalQuantity
  canonicalUnit: string
  encoding: QuantityEncoding
  confidence: number
  rule: string
  isLocked: boolean
  alternativeUnits: string[]
  /** Source of inference for UI display */
  source: InferenceSource
  /** Warning message for UI */
  warning?: string
}

export interface HeuristicRule {
  pattern: RegExp
  physicalQuantity: PhysicalQuantity
  canonicalUnit: string
  encoding: QuantityEncoding
  confidence: number
  ruleName: string
  isLocked: boolean
  alternativeUnits: string[]
  source: InferenceSource
  warning?: string
}

// =============================================================================
// PRIORITY 1: NEGATIVE GUARDS (HIGHEST PRIORITY - ALWAYS OVERRIDE)
// These rules MUST fire first and cannot be overridden
// =============================================================================

const NEGATIVE_GUARDS: HeuristicRule[] = [
  // Identifiers - ALWAYS dimensionless & locked
  { pattern: /_id$/i, physicalQuantity: 'dimensionless', canonicalUnit: 'none',
    encoding: 'identifier', confidence: 1.0, ruleName: 'guard_identifier_suffix',
    isLocked: true, alternativeUnits: [], source: 'guard' },
  { pattern: /_identifier$/i, physicalQuantity: 'dimensionless', canonicalUnit: 'none',
    encoding: 'identifier', confidence: 1.0, ruleName: 'guard_identifier_suffix2',
    isLocked: true, alternativeUnits: [], source: 'guard' },
  { pattern: /^(source_id|id|obj_?id|target_?id|hip|tyc|gaia_source|designation|name|solution_id|random_index)$/i,
    physicalQuantity: 'dimensionless', canonicalUnit: 'none', encoding: 'identifier',
    confidence: 1.0, ruleName: 'guard_identifier_exact', isLocked: true, alternativeUnits: [], source: 'guard' },
  
  // Confidence fields - ALWAYS dimensionless & locked
  { pattern: /_confidence$/i, physicalQuantity: 'dimensionless', canonicalUnit: 'none',
    encoding: 'linear', confidence: 1.0, ruleName: 'guard_confidence',
    isLocked: true, alternativeUnits: [], source: 'guard' },
  
  // Flag/Quality fields - ALWAYS dimensionless & locked
  { pattern: /_(flag|flags|quality|qf|pf)$/i, physicalQuantity: 'dimensionless',
    canonicalUnit: 'none', encoding: 'categorical', confidence: 1.0,
    ruleName: 'guard_flag_suffix', isLocked: true, alternativeUnits: [], source: 'guard' },
  { pattern: /^(flag|quality|duplicated_source|astrometric_excess_noise_sig|ipd_gof_harmonic_amplitude)$/i,
    physicalQuantity: 'dimensionless', canonicalUnit: 'none', encoding: 'categorical',
    confidence: 1.0, ruleName: 'guard_flag_exact', isLocked: true, alternativeUnits: [], source: 'guard' },
  
  // Index fields - ALWAYS dimensionless & locked
  { pattern: /_index$/i, physicalQuantity: 'dimensionless', canonicalUnit: 'none',
    encoding: 'linear', confidence: 1.0, ruleName: 'guard_index',
    isLocked: true, alternativeUnits: [], source: 'guard' },
  
  // Count/Number fields - ALWAYS count & locked
  { pattern: /_(count|number)$/i, physicalQuantity: 'count', canonicalUnit: 'count',
    encoding: 'linear', confidence: 1.0, ruleName: 'guard_count_suffix',
    isLocked: true, alternativeUnits: [], source: 'guard' },
  { pattern: /^(n_|num_|number_|matched_transits|visibility_periods_used|astrometric_n_obs_al|astrometric_n_obs_ac|astrometric_n_good_obs_al|astrometric_n_bad_obs_al|phot_bp_n_obs|phot_rp_n_obs)/i,
    physicalQuantity: 'count', canonicalUnit: 'count', encoding: 'linear',
    confidence: 1.0, ruleName: 'guard_count_prefix', isLocked: true, alternativeUnits: [], source: 'guard' },
  
  // Correlation fields - ALWAYS dimensionless & locked (NEVER angle!)
  { pattern: /correlation/i, physicalQuantity: 'dimensionless', canonicalUnit: 'none',
    encoding: 'linear', confidence: 1.0, ruleName: 'guard_correlation',
    isLocked: true, alternativeUnits: [], source: 'guard',
    warning: 'Correlation coefficients are dimensionless [-1, 1]' },
  { pattern: /_(corr|rho)$/i, physicalQuantity: 'dimensionless', canonicalUnit: 'none',
    encoding: 'linear', confidence: 1.0, ruleName: 'guard_corr_suffix',
    isLocked: true, alternativeUnits: [], source: 'guard',
    warning: 'Correlation coefficients are dimensionless [-1, 1]' },
  { pattern: /^(corr_|rho_)/i, physicalQuantity: 'dimensionless', canonicalUnit: 'none',
    encoding: 'linear', confidence: 1.0, ruleName: 'guard_corr_prefix',
    isLocked: true, alternativeUnits: [], source: 'guard',
    warning: 'Correlation coefficients are dimensionless [-1, 1]' },
  
  // Significance/Chi-squared - ALWAYS dimensionless & locked
  { pattern: /(chi2|chi_?squared|significance|astrometric_chi2_al|astrometric_excess_noise)$/i,
    physicalQuantity: 'dimensionless', canonicalUnit: 'none', encoding: 'linear',
    confidence: 1.0, ruleName: 'guard_chi2', isLocked: true, alternativeUnits: [], source: 'guard' },
  
  // Pseudocolour - dimensionless (Gaia specific)
  { pattern: /pseudocolour/i, physicalQuantity: 'dimensionless', canonicalUnit: 'none',
    encoding: 'linear', confidence: 1.0, ruleName: 'guard_pseudocolour',
    isLocked: true, alternativeUnits: [], source: 'guard' },
]

// =============================================================================
// PRIORITY 2: GAIA DOMAIN OVERRIDES
// Specific rules for Gaia catalog fields
// =============================================================================

const GAIA_DOMAIN_OVERRIDES: HeuristicRule[] = [
  // Gaia Cartesian positions (NOT angular!)
  { pattern: /^(x_gaia|x_val|ecl_x)$/i, physicalQuantity: 'length', canonicalUnit: 'AU',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_x_position',
    isLocked: false, alternativeUnits: ['pc', 'km', 'ly'], source: 'domain',
    warning: 'Gaia Cartesian X coordinate (length, not angle)' },
  { pattern: /^(y_gaia|y_val|ecl_y)$/i, physicalQuantity: 'length', canonicalUnit: 'AU',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_y_position',
    isLocked: false, alternativeUnits: ['pc', 'km', 'ly'], source: 'domain',
    warning: 'Gaia Cartesian Y coordinate (length, not angle)' },
  { pattern: /^(z_gaia|z_val|ecl_z)$/i, physicalQuantity: 'length', canonicalUnit: 'AU',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_z_position',
    isLocked: false, alternativeUnits: ['pc', 'km', 'ly'], source: 'domain',
    warning: 'Gaia Cartesian Z coordinate (length, not angle)' },
  
  // Gaia Cartesian velocities (NOT angular!)
  { pattern: /^(vx_gaia|vx_val|ecl_vx)$/i, physicalQuantity: 'velocity', canonicalUnit: 'AU/yr',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_vx_velocity',
    isLocked: false, alternativeUnits: ['km/s', 'm/s'], source: 'domain',
    warning: 'Gaia Cartesian velocity X component' },
  { pattern: /^(vy_gaia|vy_val|ecl_vy)$/i, physicalQuantity: 'velocity', canonicalUnit: 'AU/yr',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_vy_velocity',
    isLocked: false, alternativeUnits: ['km/s', 'm/s'], source: 'domain',
    warning: 'Gaia Cartesian velocity Y component' },
  { pattern: /^(vz_gaia|vz_val|ecl_vz)$/i, physicalQuantity: 'velocity', canonicalUnit: 'AU/yr',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_vz_velocity',
    isLocked: false, alternativeUnits: ['km/s', 'm/s'], source: 'domain',
    warning: 'Gaia Cartesian velocity Z component' },
  
  // Gaia photometry (logarithmic - locked)
  { pattern: /^(phot_g_mean_mag|phot_bp_mean_mag|phot_rp_mean_mag)$/i,
    physicalQuantity: 'brightness', canonicalUnit: 'mag', encoding: 'logarithmic',
    confidence: 1.0, ruleName: 'gaia_magnitude', isLocked: true, alternativeUnits: [],
    source: 'domain', warning: 'Logarithmic magnitude - cannot be linearly converted' },
  
  // Gaia flux (linear - convertible)
  { pattern: /^(phot_g_mean_flux|phot_bp_mean_flux|phot_rp_mean_flux)$/i,
    physicalQuantity: 'flux', canonicalUnit: 'e-/s', encoding: 'linear',
    confidence: 1.0, ruleName: 'gaia_flux', isLocked: false,
    alternativeUnits: ['Jy', 'mJy'], source: 'domain' },
  { pattern: /^(phot_g_mean_flux_error|phot_bp_mean_flux_error|phot_rp_mean_flux_error)$/i,
    physicalQuantity: 'flux', canonicalUnit: 'e-/s', encoding: 'linear',
    confidence: 1.0, ruleName: 'gaia_flux_error', isLocked: false,
    alternativeUnits: ['Jy', 'mJy'], source: 'domain' },
  
  // Gaia astrometry
  { pattern: /^(ref_epoch|epoch|epoch_utc)$/i, physicalQuantity: 'time', canonicalUnit: 'yr',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_epoch',
    isLocked: false, alternativeUnits: ['JD', 'MJD'], source: 'domain' },
  
  // Gaia parallax
  { pattern: /^(parallax|parallax_over_error)$/i, physicalQuantity: 'angle', canonicalUnit: 'mas',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_parallax',
    isLocked: false, alternativeUnits: ['arcsec'], source: 'domain' },
  
  // Gaia proper motion
  { pattern: /^(pmra|pmdec)$/i, physicalQuantity: 'angle', canonicalUnit: 'mas/yr',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_proper_motion',
    isLocked: false, alternativeUnits: ['arcsec/yr', 'deg/yr'], source: 'domain' },
  
  // Gaia sky coordinates
  { pattern: /^(ra|dec|l|b)$/i, physicalQuantity: 'angle', canonicalUnit: 'deg',
    encoding: 'linear', confidence: 1.0, ruleName: 'gaia_sky_coord',
    isLocked: false, alternativeUnits: ['rad', 'arcmin', 'arcsec'], source: 'domain' },
  
  // Gaia radial velocity
  { pattern: /^(radial_velocity|dr2_radial_velocity)$/i, physicalQuantity: 'velocity',
    canonicalUnit: 'km/s', encoding: 'linear', confidence: 1.0,
    ruleName: 'gaia_radial_velocity', isLocked: false,
    alternativeUnits: ['m/s', 'AU/yr'], source: 'domain' },
  
  // Gaia temperature
  { pattern: /^(teff_val|teff_gspphot|teff_gspspec)$/i, physicalQuantity: 'temperature',
    canonicalUnit: 'K', encoding: 'linear', confidence: 1.0,
    ruleName: 'gaia_temperature', isLocked: false, alternativeUnits: ['C'], source: 'domain' },
  
  // Gaia extinction/reddening
  { pattern: /^(ag_gspphot|ebpminrp_gspphot|a_g_val|e_bp_min_rp_val)$/i,
    physicalQuantity: 'brightness', canonicalUnit: 'mag', encoding: 'linear',
    confidence: 1.0, ruleName: 'gaia_extinction', isLocked: false,
    alternativeUnits: ['mag'], source: 'domain' },
  
  // Gaia luminosity/radius
  { pattern: /^(lum_val|radius_val)$/i, physicalQuantity: 'length',
    canonicalUnit: 'R_sun', encoding: 'linear', confidence: 1.0,
    ruleName: 'gaia_stellar_radius', isLocked: false,
    alternativeUnits: ['km', 'AU'], source: 'domain' },
  
  // Gaia distance
  { pattern: /^(dist|distance_gspphot|r_med_geo|r_lo_geo|r_hi_geo|r_med_photogeo)$/i,
    physicalQuantity: 'distance', canonicalUnit: 'pc', encoding: 'linear',
    confidence: 1.0, ruleName: 'gaia_distance', isLocked: false,
    alternativeUnits: ['kpc', 'AU', 'ly'], source: 'domain' },
]

// =============================================================================
// PRIORITY 3: NAME-BASED HEURISTICS (General astronomy)
// =============================================================================

const NAME_HEURISTICS: HeuristicRule[] = [
  // ANGULAR COORDINATES
  { pattern: /^(ra|ra_?deg|ra_?j?2000|right_?ascension|alpha)$/i,
    physicalQuantity: 'angle', canonicalUnit: 'deg', encoding: 'linear',
    confidence: 0.95, ruleName: 'right_ascension', isLocked: false,
    alternativeUnits: ['rad', 'hour_angle', 'arcmin', 'arcsec'], source: 'name' },
  { pattern: /^(dec|dec_?deg|dec_?j?2000|declination|delta)$/i,
    physicalQuantity: 'angle', canonicalUnit: 'deg', encoding: 'linear',
    confidence: 0.95, ruleName: 'declination', isLocked: false,
    alternativeUnits: ['rad', 'arcmin', 'arcsec'], source: 'name' },
  { pattern: /^(l|b|glon|glat|gal_?lon|gal_?lat)$/i, physicalQuantity: 'angle',
    canonicalUnit: 'deg', encoding: 'linear', confidence: 0.9,
    ruleName: 'galactic_coords', isLocked: false, alternativeUnits: ['rad'], source: 'name' },
  { pattern: /position_?angle/i, physicalQuantity: 'angle', canonicalUnit: 'deg',
    encoding: 'linear', confidence: 0.9, ruleName: 'position_angle',
    isLocked: false, alternativeUnits: ['rad'], source: 'name' },
  
  // PROPER MOTION
  { pattern: /^(pmra|pm_?ra|pm_?alpha|proper_?motion_?ra)/i,
    physicalQuantity: 'angle', canonicalUnit: 'mas/yr', encoding: 'linear',
    confidence: 0.95, ruleName: 'proper_motion_ra', isLocked: false,
    alternativeUnits: ['arcsec/yr', 'deg/yr'], source: 'name' },
  { pattern: /^(pmdec|pm_?dec|pm_?delta|proper_?motion_?dec)/i,
    physicalQuantity: 'angle', canonicalUnit: 'mas/yr', encoding: 'linear',
    confidence: 0.95, ruleName: 'proper_motion_dec', isLocked: false,
    alternativeUnits: ['arcsec/yr', 'deg/yr'], source: 'name' },
  
  // PARALLAX / DISTANCE
  { pattern: /^(parallax|plx|varpi)/i, physicalQuantity: 'angle',
    canonicalUnit: 'mas', encoding: 'linear', confidence: 0.95,
    ruleName: 'parallax', isLocked: false, alternativeUnits: ['arcsec'], source: 'name' },
  { pattern: /^(dist|distance|r_?est|r_?geo|dist_?pc)/i, physicalQuantity: 'distance',
    canonicalUnit: 'pc', encoding: 'linear', confidence: 0.9,
    ruleName: 'distance', isLocked: false, alternativeUnits: ['kpc', 'AU', 'ly', 'km'], source: 'name' },
  
  // MAGNITUDES (Logarithmic - LOCKED)
  { pattern: /_(mag|phot)$/i, physicalQuantity: 'brightness', canonicalUnit: 'mag',
    encoding: 'logarithmic', confidence: 0.95, ruleName: 'magnitude_suffix',
    isLocked: true, alternativeUnits: [], source: 'name',
    warning: 'Logarithmic magnitude - cannot be linearly converted' },
  { pattern: /^(mag_|phot_|[ugrizy]_?mag|[UBVRI]_?mag)/i,
    physicalQuantity: 'brightness', canonicalUnit: 'mag', encoding: 'logarithmic',
    confidence: 0.95, ruleName: 'magnitude_prefix', isLocked: true, alternativeUnits: [],
    source: 'name', warning: 'Logarithmic magnitude - cannot be linearly converted' },
  { pattern: /^(gmag|bpmag|rpmag|jmag|hmag|kmag|vmag|bmag|rmag|imag|umag)/i,
    physicalQuantity: 'brightness', canonicalUnit: 'mag', encoding: 'logarithmic',
    confidence: 0.95, ruleName: 'standard_magnitude', isLocked: true, alternativeUnits: [],
    source: 'name', warning: 'Logarithmic magnitude - cannot be linearly converted' },
  
  // FLUX (Linear)
  { pattern: /_flux$/i, physicalQuantity: 'flux', canonicalUnit: 'e-/s',
    encoding: 'linear', confidence: 0.9, ruleName: 'flux_suffix',
    isLocked: false, alternativeUnits: ['Jy', 'mJy'], source: 'name' },
  { pattern: /^(flux_)/i, physicalQuantity: 'flux', canonicalUnit: 'e-/s',
    encoding: 'linear', confidence: 0.9, ruleName: 'flux_prefix',
    isLocked: false, alternativeUnits: ['Jy', 'mJy'], source: 'name' },
  
  // COLOR INDICES
  { pattern: /^(bp_?rp|g_?rp|bp_?g|b_?v|u_?b|v_?i|color)/i,
    physicalQuantity: 'brightness', canonicalUnit: 'mag', encoding: 'linear',
    confidence: 0.9, ruleName: 'color_index', isLocked: false, alternativeUnits: ['mag'], source: 'name' },
  
  // VELOCITY
  { pattern: /^(radial_?velocity|rv|v_?rad)/i, physicalQuantity: 'velocity',
    canonicalUnit: 'km/s', encoding: 'linear', confidence: 0.95,
    ruleName: 'radial_velocity', isLocked: false, alternativeUnits: ['m/s', 'AU/yr'], source: 'name' },
  { pattern: /^[vV][xyzXYZ]$/i, physicalQuantity: 'velocity', canonicalUnit: 'km/s',
    encoding: 'linear', confidence: 0.8, ruleName: 'velocity_component',
    isLocked: false, alternativeUnits: ['m/s', 'AU/yr'], source: 'name' },
  
  // CARTESIAN POSITION
  { pattern: /^[xyzXYZ]$/i, physicalQuantity: 'length', canonicalUnit: 'AU',
    encoding: 'linear', confidence: 0.7, ruleName: 'cartesian_position',
    isLocked: false, alternativeUnits: ['pc', 'km', 'ly'], source: 'name' },
  
  // TIME / EPOCH
  { pattern: /^(epoch|ref_?epoch|obs_?time|mjd|jd|julian)/i,
    physicalQuantity: 'time', canonicalUnit: 'yr', encoding: 'linear',
    confidence: 0.9, ruleName: 'time_epoch', isLocked: false,
    alternativeUnits: ['day', 'JD', 'MJD'], source: 'name' },
  
  // TEMPERATURE (explicit names only)
  { pattern: /^(teff|t_?eff|temperature)$/i, physicalQuantity: 'temperature',
    canonicalUnit: 'K', encoding: 'linear', confidence: 0.95,
    ruleName: 'temperature', isLocked: false, alternativeUnits: ['C', 'F'], source: 'name' },
  
  // MASS / RADIUS
  { pattern: /^(mass|m_?star|stellar_?mass)/i, physicalQuantity: 'mass',
    canonicalUnit: 'M_sun', encoding: 'linear', confidence: 0.9,
    ruleName: 'stellar_mass', isLocked: false, alternativeUnits: ['kg', 'M_earth'], source: 'name' },
  { pattern: /^(radius|r_?star|stellar_?radius)/i, physicalQuantity: 'length',
    canonicalUnit: 'R_sun', encoding: 'linear', confidence: 0.9,
    ruleName: 'stellar_radius', isLocked: false, alternativeUnits: ['km', 'AU'], source: 'name' },
  { pattern: /^(pl_?rade|planet_?radius)/i, physicalQuantity: 'length',
    canonicalUnit: 'R_earth', encoding: 'linear', confidence: 0.95,
    ruleName: 'planetary_radius', isLocked: false, alternativeUnits: ['R_jup', 'km'], source: 'name' },
  { pattern: /^(pl_?masse|planet_?mass)/i, physicalQuantity: 'mass',
    canonicalUnit: 'M_earth', encoding: 'linear', confidence: 0.95,
    ruleName: 'planetary_mass', isLocked: false, alternativeUnits: ['M_jup', 'kg'], source: 'name' },
  
  // ERRORS (inherit from base - handled specially)
  { pattern: /_(error|err|uncertainty|sigma)$/i, physicalQuantity: 'dimensionless',
    canonicalUnit: 'same_as_base', encoding: 'linear', confidence: 0.9,
    ruleName: 'error_suffix', isLocked: false, alternativeUnits: [], source: 'name' },
  { pattern: /^(e_|err_)/i, physicalQuantity: 'dimensionless',
    canonicalUnit: 'same_as_base', encoding: 'linear', confidence: 0.85,
    ruleName: 'error_prefix', isLocked: false, alternativeUnits: [], source: 'name' },
]

// Combined rules in priority order
export const ASTRONOMY_HEURISTICS: HeuristicRule[] = [
  ...NEGATIVE_GUARDS,      // Priority 1: Always override
  ...GAIA_DOMAIN_OVERRIDES, // Priority 2: Domain-specific
  ...NAME_HEURISTICS,       // Priority 3: General name patterns
]

/** Match a field name against astronomy heuristics */
export function matchFieldHeuristic(fieldName: string): HeuristicMatch | null {
  const normalizedName = fieldName.toLowerCase().trim()
  for (const rule of ASTRONOMY_HEURISTICS) {
    if (rule.pattern.test(normalizedName)) {
      return {
        physicalQuantity: rule.physicalQuantity,
        canonicalUnit: rule.canonicalUnit,
        encoding: rule.encoding,
        confidence: rule.confidence,
        rule: rule.ruleName,
        isLocked: rule.isLocked,
        alternativeUnits: rule.alternativeUnits,
        source: rule.source,
        warning: rule.warning,
      }
    }
  }
  return null
}

/** Resolve error field units based on base field */
export function resolveErrorFieldUnit(
  errorFieldName: string,
  allFields: Map<string, HeuristicMatch>
): HeuristicMatch | null {
  const normalized = errorFieldName.toLowerCase()
  const errorPatterns = [/_error$/, /_err$/, /_unc$/, /_upper$/, /_lower$/]
  const errorPrefixes = [/^e_/, /^err_/]

  for (const pattern of errorPatterns) {
    if (pattern.test(normalized)) {
      const baseName = normalized.replace(pattern, '')
      const baseMatch = allFields.get(baseName)
      if (baseMatch && baseMatch.canonicalUnit !== 'same_as_base') {
        return { ...baseMatch, rule: `error_inherits_from_${baseName}`,
          confidence: baseMatch.confidence * 0.9 }
      }
    }
  }

  for (const pattern of errorPrefixes) {
    if (pattern.test(normalized)) {
      const baseName = normalized.replace(pattern, '')
      const baseMatch = allFields.get(baseName)
      if (baseMatch && baseMatch.canonicalUnit !== 'same_as_base') {
        return { ...baseMatch, rule: `error_inherits_from_${baseName}`,
          confidence: baseMatch.confidence * 0.9 }
      }
    }
  }
  return null
}

/** Analyze all fields using heuristics (two-pass for error resolution) */
export function analyzeFieldsWithHeuristics(
  fieldNames: string[]
): Map<string, HeuristicMatch> {
  const results = new Map<string, HeuristicMatch>()

  // First pass: match non-error fields
  for (const name of fieldNames) {
    const match = matchFieldHeuristic(name)
    if (match && match.canonicalUnit !== 'same_as_base') {
      results.set(name.toLowerCase(), match)
    }
  }

  // Second pass: resolve error fields
  for (const name of fieldNames) {
    const normalized = name.toLowerCase()
    if (results.has(normalized)) continue
    const match = matchFieldHeuristic(name)
    if (match && match.canonicalUnit === 'same_as_base') {
      const resolved = resolveErrorFieldUnit(name, results)
      if (resolved) results.set(normalized, resolved)
    }
  }
  return results
}

/**
 * Check if values look like correlation coefficients [-1, 1]
 * This is an additional guard - if true, field MUST be dimensionless
 */
export function isCorrelationByValue(values: (number | string | null)[]): boolean {
  const nums = values.filter((v): v is number => typeof v === 'number' && !isNaN(v))
  if (nums.length < 3) return false
  const min = Math.min(...nums), max = Math.max(...nums)
  // Strictly within [-1, 1] with some values not at extremes
  return min >= -1.001 && max <= 1.001 && (min < 0 || max < 0.5)
}

/**
 * Infer quantity from value distribution.
 * CRITICAL: This is DISABLED unless name-based heuristics agree.
 * Returns the inference for comparison only - caller must validate.
 */
export function inferQuantityFromValues(
  values: (number | string | null)[],
  fieldName?: string
): { quantity: PhysicalQuantity; confidence: number; reason: string } | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && !isNaN(v))
  if (nums.length === 0) return null

  const min = Math.min(...nums), max = Math.max(...nums)

  // GUARD: Correlation values - ALWAYS dimensionless
  if (isCorrelationByValue(values)) {
    return { 
      quantity: 'dimensionless', 
      confidence: 0.9, 
      reason: 'value_range_suggests_correlation_[-1,1]' 
    }
  }

  // Value-based inferences (LOW confidence - require name agreement)
  if (min >= 0 && max <= 360)
    return { quantity: 'angle', confidence: 0.3, reason: 'value_range_0_360_possible_angle' }
  if (min >= -90 && max <= 90)
    return { quantity: 'angle', confidence: 0.25, reason: 'value_range_-90_90_possible_angle' }
  if (min >= 1000 && max <= 100000)
    return { quantity: 'temperature', confidence: 0.2, reason: 'value_range_1000_100000_possible_temp' }
  if (min >= -30 && max <= 30)
    return { quantity: 'brightness', confidence: 0.15, reason: 'value_range_-30_30_possible_mag' }

  return null
}

/**
 * Validate value inference against name inference.
 * Value inference is ONLY allowed if name agrees.
 */
export function validateValueInference(
  nameInference: HeuristicMatch | null,
  valueInference: { quantity: PhysicalQuantity; confidence: number; reason: string } | null
): { quantity: PhysicalQuantity; confidence: number; reason: string; source: InferenceSource } | null {
  // No value inference - nothing to validate
  if (!valueInference) return null
  
  // Correlation by value - ALWAYS accept (it's a guard)
  if (valueInference.reason.includes('correlation')) {
    return { ...valueInference, source: 'guard' }
  }
  
  // No name inference - DO NOT use value inference alone
  if (!nameInference) {
    return null // Fail-safe: do not infer from values alone
  }
  
  // Name and value agree - accept with boosted confidence
  if (nameInference.physicalQuantity === valueInference.quantity) {
    return {
      quantity: valueInference.quantity,
      confidence: Math.min(0.9, nameInference.confidence + 0.1),
      reason: `${nameInference.rule}_confirmed_by_${valueInference.reason}`,
      source: 'name',
    }
  }
  
  // Name and value disagree - trust name, ignore value
  return null
}
