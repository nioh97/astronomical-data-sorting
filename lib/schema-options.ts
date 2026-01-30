export const DATA_TYPES = [
  "Coordinate",
  "Distance",
  "Physical Property",
  "Photometric / Brightness",
  "Motion / Kinematics",
  "Time / Temporal",
  "Identifier",
  "Categorical",
  "Uncertainty / Error",
  "Not used for analysis",
]

export const UNITS_BY_TYPE: Record<string, string[]> = {
  Coordinate: ["degrees", "radians"],
  Distance: ["parsec", "light year", "AU", "km"],
  "Physical Property": ["SI", "solar units", "earth units"],
  "Photometric / Brightness": ["magnitude"],
  "Motion / Kinematics": ["mas/yr", "km/s"],
  "Time / Temporal": ["ISO 8601", "JD", "MJD"],
  Identifier: [],
  Categorical: [],
  "Uncertainty / Error": ["same as value"],
  "Not used for analysis": [],
}
