/**
 * Synthetic Metadata Generation
 * Detects missing metadata and generates synthetic metadata using heuristics.
 */

import {
  analyzeFieldsWithHeuristics,
  inferQuantityFromValues,
  isCorrelationByValue,
  validateValueInference,
  matchFieldHeuristic,
  type HeuristicMatch,
  type PhysicalQuantity,
  type QuantityEncoding,
  type InferenceSource,
} from './astronomy-heuristics'

export interface MetadataPresenceResult {
  hasMetadata: boolean
  metadataType: 'comment' | 'schema' | 'none'
  detectedPatterns: string[]
}

export interface SyntheticFieldMetadata {
  fieldName: string
  physicalQuantity: PhysicalQuantity
  canonicalUnit: string
  encoding: QuantityEncoding
  confidence: number
  source: 'heuristic' | 'value_inference' | 'fallback'
  rule: string
  isLocked: boolean
  alternativeUnits: string[]
  unitRequired: boolean
}

export interface SyntheticMetadataResult {
  metadataPresent: boolean
  metadataType: 'comment' | 'schema' | 'none'
  fields: SyntheticFieldMetadata[]
  auditLog: AuditLogEntry[]
}

export interface AuditLogEntry {
  fieldName: string
  source: 'heuristic' | 'value_inference' | 'fallback'
  rule: string
  confidence: number
  physicalQuantity: PhysicalQuantity
  canonicalUnit: string
  timestamp: number
}

const METADATA_COMMENT_PATTERNS = [
  /^#\s*COLUMN/i, /^#\s*UNIT/i, /^#\s*DESCRIPTION/i,
  /^#\s*FORMAT/i, /^#\s*NULL/i, /^#\s*DATATYPE/i,
]

const METADATA_SCHEMA_PATTERNS = [
  /"@type"/i, /"schema"/i, /"columns"/i,
  /<FIELD\s+/i, /<TABLE\s+/i, /<VOTABLE/i,
]

export function detectMetadataPresence(
  rawText: string,
  metadata?: Record<string, any>
): MetadataPresenceResult {
  const detectedPatterns: string[] = []
  
  if (metadata && Object.keys(metadata).length > 0) {
    const hasColumnMeta = Object.values(metadata).some(
      (v) => typeof v === 'object' && v !== null && ('unit' in v || 'description' in v)
    )
    if (hasColumnMeta) {
      return { hasMetadata: true, metadataType: 'schema', detectedPatterns: ['parsed_metadata'] }
    }
  }

  const lines = rawText.split('\n').slice(0, 50)
  for (const line of lines) {
    for (const pattern of METADATA_COMMENT_PATTERNS) {
      if (pattern.test(line)) {
        detectedPatterns.push(pattern.source)
        return { hasMetadata: true, metadataType: 'comment', detectedPatterns }
      }
    }
  }

  for (const pattern of METADATA_SCHEMA_PATTERNS) {
    if (pattern.test(rawText.slice(0, 5000))) {
      detectedPatterns.push(pattern.source)
      return { hasMetadata: true, metadataType: 'schema', detectedPatterns }
    }
  }

  return { hasMetadata: false, metadataType: 'none', detectedPatterns: [] }
}

function inferFieldType(values: any[]): 'number' | 'string' | 'mixed' {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '')
  if (nonNull.length === 0) return 'string'
  const numeric = nonNull.filter(
    (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))
  )
  if (numeric.length === nonNull.length) return 'number'
  if (numeric.length === 0) return 'string'
  return 'mixed'
}

function getDefaultUnitForQuantity(quantity: PhysicalQuantity): string {
  const defaults: Record<PhysicalQuantity, string> = {
    angle: 'deg', length: 'AU', distance: 'pc', velocity: 'km/s',
    time: 'yr', brightness: 'mag', flux: 'e-/s', temperature: 'K',
    mass: 'M_sun', frequency: 'Hz', count: 'count', dimensionless: 'none',
  }
  return defaults[quantity] || 'unknown'
}

function getAlternativeUnitsForQuantity(quantity: PhysicalQuantity): string[] {
  const alts: Record<PhysicalQuantity, string[]> = {
    angle: ['deg', 'rad', 'arcmin', 'arcsec', 'mas'],
    length: ['AU', 'pc', 'km', 'ly', 'R_sun'],
    distance: ['pc', 'kpc', 'Mpc', 'AU', 'ly'],
    velocity: ['km/s', 'm/s', 'AU/yr'],
    time: ['yr', 'day', 'JD', 'MJD'],
    brightness: ['mag'], flux: ['e-/s', 'Jy'],
    temperature: ['K', 'C'], mass: ['M_sun', 'kg'],
    frequency: ['Hz'], count: [], dimensionless: [],
  }
  return alts[quantity] || []
}

export function generateSyntheticMetadata(
  fieldNames: string[],
  sampleRows: Record<string, any>[],
  rawText?: string,
  existingMetadata?: Record<string, any>
): SyntheticMetadataResult {
  const auditLog: AuditLogEntry[] = []
  const fields: SyntheticFieldMetadata[] = []
  const timestamp = Date.now()
  const presence = detectMetadataPresence(rawText || '', existingMetadata)
  const heuristicMatches = analyzeFieldsWithHeuristics(fieldNames)

  for (const fieldName of fieldNames) {
    const normalizedName = fieldName.toLowerCase()
    const hMatch = heuristicMatches.get(normalizedName)

    if (hMatch) {
      const field: SyntheticFieldMetadata = {
        fieldName, physicalQuantity: hMatch.physicalQuantity,
        canonicalUnit: hMatch.canonicalUnit, encoding: hMatch.encoding,
        confidence: hMatch.confidence, source: 'heuristic',
        rule: hMatch.rule, isLocked: hMatch.isLocked,
        alternativeUnits: hMatch.alternativeUnits,
        unitRequired: !hMatch.isLocked && 
          hMatch.physicalQuantity !== 'dimensionless' &&
          hMatch.physicalQuantity !== 'count' &&
          hMatch.encoding !== 'logarithmic',
      }
      fields.push(field)
      auditLog.push({ fieldName, source: 'heuristic', rule: hMatch.rule,
        confidence: hMatch.confidence, physicalQuantity: hMatch.physicalQuantity,
        canonicalUnit: hMatch.canonicalUnit, timestamp })
      continue
    }

    // CRITICAL: Value inference is DISABLED unless name agrees or it's a correlation guard
    const values = sampleRows.map((row) => row[fieldName])
    
    // Check for correlation by value (GUARD - always applies)
    if (isCorrelationByValue(values)) {
      const field: SyntheticFieldMetadata = {
        fieldName, physicalQuantity: 'dimensionless',
        canonicalUnit: 'none', encoding: 'linear', confidence: 0.95,
        source: 'heuristic', rule: 'guard_correlation_by_value',
        isLocked: true, alternativeUnits: [], unitRequired: false,
      }
      fields.push(field)
      auditLog.push({ fieldName, source: 'heuristic', rule: 'guard_correlation_by_value',
        confidence: 0.95, physicalQuantity: 'dimensionless',
        canonicalUnit: 'none', timestamp })
      continue
    }
    
    // Try value inference but ONLY if it matches name patterns (not used standalone)
    const nameMatch = matchFieldHeuristic(fieldName)
    const valInfer = inferQuantityFromValues(values, fieldName)
    const validatedInfer = validateValueInference(nameMatch, valInfer)
    
    if (validatedInfer) {
      const field: SyntheticFieldMetadata = {
        fieldName, physicalQuantity: validatedInfer.quantity,
        canonicalUnit: getDefaultUnitForQuantity(validatedInfer.quantity),
        encoding: 'linear', confidence: validatedInfer.confidence,
        source: 'value_inference', rule: validatedInfer.reason,
        isLocked: false, alternativeUnits: getAlternativeUnitsForQuantity(validatedInfer.quantity),
        unitRequired: validatedInfer.quantity !== 'dimensionless',
      }
      fields.push(field)
      auditLog.push({ fieldName, source: 'value_inference', rule: validatedInfer.reason,
        confidence: validatedInfer.confidence, physicalQuantity: validatedInfer.quantity,
        canonicalUnit: field.canonicalUnit, timestamp })
      continue
    }

    const inferredType = inferFieldType(values)
    const isNumeric = inferredType === 'number'
    const field: SyntheticFieldMetadata = {
      fieldName, physicalQuantity: 'dimensionless',
      canonicalUnit: 'unknown', encoding: isNumeric ? 'linear' : 'categorical',
      confidence: 0.1, source: 'fallback',
      rule: isNumeric ? 'numeric_unclassified' : 'string_passthrough',
      isLocked: !isNumeric, alternativeUnits: [], unitRequired: false,
    }
    fields.push(field)
    auditLog.push({ fieldName, source: 'fallback', rule: field.rule,
      confidence: 0.1, physicalQuantity: 'dimensionless',
      canonicalUnit: 'unknown', timestamp })
  }

  return { metadataPresent: presence.hasMetadata, metadataType: presence.metadataType, fields, auditLog }
}

export function buildMetadataInjectionPrompt(syntheticMeta: SyntheticMetadataResult): string {
  const high = syntheticMeta.fields.filter((f) => f.confidence >= 0.7)
  const med = syntheticMeta.fields.filter((f) => f.confidence >= 0.4 && f.confidence < 0.7)
  const low = syntheticMeta.fields.filter((f) => f.confidence < 0.4)

  const highStr = high.length > 0
    ? high.map((f) => '- ' + f.fieldName + ': ' + f.physicalQuantity + ' (' + f.canonicalUnit + ') [' + f.rule + ']').join('\n')
    : 'None'
  const medStr = med.length > 0
    ? med.map((f) => '- ' + f.fieldName + ': ' + f.physicalQuantity + ' (' + f.canonicalUnit + ') [' + f.rule + ']').join('\n')
    : 'None'
  const lowStr = low.length > 0
    ? low.map((f) => '- ' + f.fieldName + ': needs classification').join('\n')
    : 'None'

  return 'IMPORTANT: The following metadata was inferred using astronomy-specific heuristics.\n' +
    'You MUST respect these classifications. Do NOT override unless you have strong evidence.\n\n' +
    '=== HIGH CONFIDENCE (DO NOT CHANGE) ===\n' + highStr + '\n\n' +
    '=== MEDIUM CONFIDENCE (CONFIRM OR REFINE) ===\n' + medStr + '\n\n' +
    '=== LOW CONFIDENCE (YOU MAY CLASSIFY) ===\n' + lowStr + '\n\n' +
    'RULES:\n' +
    '1. HIGH confidence: Keep physicalQuantity and canonicalUnit exactly as shown\n' +
    '2. MEDIUM confidence: Confirm or suggest alternative with strong evidence\n' +
    '3. LOW confidence: Attempt classification using astronomical context\n' +
    '4. NEVER mark numeric physical quantities as dimensionless unless truly unitless\n' +
    '5. Units LOCKED only for: identifiers, flags, correlations, counts'
}
