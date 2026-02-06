"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Activity, Clock } from "lucide-react"

type TelescopeStatus = "tracking" | "calibrating" | "idle"
type ObjectType = "star" | "galaxy" | "exoplanet" | "transient"

export type ObservatoryInstitution = {
  id: string
  label: string
  wavelengthNm: number
  seed: string
}

type TelemetryRow = {
  id: string
  timestampUtc: string
  timestampMs: number
  raDeg: number
  decDeg: number
  wavelengthNm: number
  flux: number
  signalToNoise: number
  telescopeStatus: TelescopeStatus
  objectType: ObjectType
  confidence: number
}

const INSTITUTIONS: ObservatoryInstitution[] = [
  {
    id: "iitb-radio",
    label: "IIT Bombay – Radio Observatory",
    wavelengthNm: 2.1e8, // 21 cm
    seed: "IITB-RADIO-21CM",
  },
  {
    id: "mit-optical",
    label: "MIT – Optical Telescope Array",
    wavelengthNm: 550, // green optical
    seed: "MIT-OPTICAL-550NM",
  },
  {
    id: "caltech-ir",
    label: "Caltech – Infrared Sky Monitor",
    wavelengthNm: 2200, // near-IR
    seed: "CALTECH-IR-2.2UM",
  },
]

// -----------------------------------------------------------------------------
// Deterministic RNG (seeded) + Gaussian
// -----------------------------------------------------------------------------

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0]
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x))
}

function wrap360(x: number) {
  const v = x % 360
  return v < 0 ? v + 360 : v
}

function gaussian(rng: () => number) {
  // Box–Muller
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function formatHms(ms: number) {
  const d = new Date(ms)
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  const ss = String(d.getUTCSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

function formatNumber(x: number) {
  if (!Number.isFinite(x)) return "—"
  if (Math.abs(x) >= 1e6 || Math.abs(x) < 1e-2) return x.toExponential(3)
  return x.toFixed(3)
}

// -----------------------------------------------------------------------------
// Simulation model (smooth drift, bounded, realistic-ish)
// -----------------------------------------------------------------------------

type SimState = {
  rng: () => number
  ra: number
  dec: number
  raVel: number
  decVel: number
  fluxBase: number
  fluxSigma: number
  status: TelescopeStatus
  objectType: ObjectType
  step: number
}

function initialSim(institution: ObservatoryInstitution): SimState {
  const seedParts = cyrb128(institution.seed)
  const rng = mulberry32(seedParts[0] ^ seedParts[1])

  const ra = rng() * 360
  const dec = rng() * 120 - 60 // [-60, +60]
  const raVel = (rng() * 0.25 + 0.05) * (rng() < 0.5 ? -1 : 1)
  const decVel = (rng() * 0.08 + 0.01) * (rng() < 0.5 ? -1 : 1)

  const bandScale =
    institution.id === "iitb-radio" ? 8e3 : institution.id === "caltech-ir" ? 4e2 : 2e2
  const fluxBase = bandScale * (0.6 + rng() * 0.8)
  const fluxSigma = Math.max(1, fluxBase * (0.03 + rng() * 0.02))

  const status: TelescopeStatus = "tracking"
  const objectType: ObjectType =
    rng() < 0.55 ? "star" : rng() < 0.8 ? "galaxy" : rng() < 0.93 ? "exoplanet" : "transient"

  return { rng, ra, dec, raVel, decVel, fluxBase, fluxSigma, status, objectType, step: 0 }
}

function maybeTransitionStatus(s: SimState) {
  const r = s.rng()
  if (s.status === "tracking") {
    if (r < 0.06) s.status = "calibrating"
    else if (r < 0.09) s.status = "idle"
  } else if (s.status === "calibrating") {
    if (r < 0.35) s.status = "tracking"
  } else {
    if (r < 0.45) s.status = "tracking"
  }
}

function maybeChangeObjectType(s: SimState) {
  const r = s.rng()
  if (r < 0.06) {
    s.objectType =
      r < 0.03 ? "transient" : r < 0.04 ? "exoplanet" : r < 0.05 ? "galaxy" : "star"
  }
}

function generateRow(
  institution: ObservatoryInstitution,
  s: SimState,
  nowMs: number,
): TelemetryRow {
  s.step += 1

  s.raVel = clamp(s.raVel + gaussian(s.rng) * 0.01, -0.6, 0.6)
  s.decVel = clamp(s.decVel + gaussian(s.rng) * 0.004, -0.25, 0.25)

  s.ra = wrap360(s.ra + s.raVel + gaussian(s.rng) * 0.03)
  s.dec = clamp(s.dec + s.decVel + gaussian(s.rng) * 0.02, -90, 90)

  maybeTransitionStatus(s)
  maybeChangeObjectType(s)

  const statusFactor =
    s.status === "tracking" ? 1.0 : s.status === "calibrating" ? 0.35 : 0.15
  const objectFactor =
    s.objectType === "transient"
      ? 1.8
      : s.objectType === "exoplanet"
        ? 0.75
        : s.objectType === "galaxy"
          ? 1.1
          : 1.0
  const base = s.fluxBase * statusFactor * objectFactor
  const noise = gaussian(s.rng) * s.fluxSigma
  const flux = Math.max(0, base + noise)

  const snr = clamp(flux / Math.max(1, s.fluxSigma * 2.2), 0.2, 120)
  const confidence = clamp(1 / (1 + Math.exp(-(snr - 6) / 2.5)), 0, 1)

  const timestampUtc = new Date(nowMs).toISOString()

  return {
    id: `${institution.id}-${nowMs}-${s.step}`,
    timestampUtc,
    timestampMs: nowMs,
    raDeg: s.ra,
    decDeg: s.dec,
    wavelengthNm: institution.wavelengthNm,
    flux,
    signalToNoise: snr,
    telescopeStatus: s.status,
    objectType: s.objectType,
    confidence,
  }
}

export default function UniversityLiveObservatory() {
  const [institutionId, setInstitutionId] = useState(INSTITUTIONS[0].id)
  const institution = useMemo(
    () => INSTITUTIONS.find((i) => i.id === institutionId) ?? INSTITUTIONS[0],
    [institutionId],
  )

  const [rows, setRows] = useState<TelemetryRow[]>([])
  const [lastUpdateMs, setLastUpdateMs] = useState<number | null>(null)
  const [lastRowId, setLastRowId] = useState<string | null>(null)

  const simRef = useRef<SimState | null>(null)
  const nextEmitRef = useRef<number>(0)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Reset stream on institution change
  useEffect(() => {
    simRef.current = initialSim(institution)
    setRows([])
    setLastUpdateMs(null)
    setLastRowId(null)
    nextEmitRef.current = 0
  }, [institution])

  // Live generator scheduler (setInterval, 1–3s emissions)
  useEffect(() => {
    let mounted = true
    const tick = () => {
      const now = Date.now()
      if (!mounted) return
      if (!simRef.current) return
      if (nextEmitRef.current === 0) {
        nextEmitRef.current = now + (1000 + simRef.current.rng() * 2000)
      }
      if (now < nextEmitRef.current) return

      const row = generateRow(institution, simRef.current, now)
      nextEmitRef.current = now + (1000 + simRef.current.rng() * 2000)

      setRows((prev) => {
        const next = [...prev, row]
        if (next.length > 150) next.splice(0, next.length - 150)
        return next
      })
      setLastUpdateMs(now)
      setLastRowId(row.id)
    }

    const interval = window.setInterval(tick, 250)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [institution])

  // Auto-scroll to newest
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [rows.length])

  // Brief highlight reset
  useEffect(() => {
    if (!lastRowId) return
    const t = window.setTimeout(() => setLastRowId(null), 800)
    return () => window.clearTimeout(t)
  }, [lastRowId])

  const chartData = useMemo(
    () =>
      rows.slice(Math.max(0, rows.length - 60)).map((r) => ({
        t: r.timestampMs,
        flux: r.flux,
        snr: r.signalToNoise,
      })),
    [rows],
  )

  return (
    <div className="w-full min-h-screen p-6 bg-zinc-950 text-zinc-100 space-y-6">
      {/* Debug header to verify render path */}
      <div className="text-xs text-emerald-400 font-mono">
        University Observatory Loaded
      </div>

      {/* Top bar */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            University Live Observatory
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Read-only institutional telemetry feed (simulated). Designed for future real
            observatory integrations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className="bg-emerald-900/30 text-emerald-300 border border-emerald-800 flex items-center gap-2"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            LIVE
          </Badge>
          <div className="text-xs text-zinc-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {lastUpdateMs ? `Last update: ${formatHms(lastUpdateMs)} UTC` : "Initializing…"}
          </div>
        </div>
      </div>

      {/* Institution selector */}
      <Card className="border-zinc-800 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Activity className="h-4 w-4 text-zinc-400" />
            <span className="font-medium">Institution</span>
          </div>
          <Select value={institutionId} onValueChange={setInstitutionId}>
            <SelectTrigger className="w-[320px] bg-zinc-950 border-zinc-800 text-zinc-100">
              <SelectValue placeholder="Select institution" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800">
              {INSTITUTIONS.map((inst) => (
                <SelectItem
                  key={inst.id}
                  value={inst.id}
                  className="text-zinc-200 focus:bg-zinc-900 focus:text-zinc-100"
                >
                  {inst.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 text-xs text-zinc-400">
          Wavelength:{" "}
          <span className="text-zinc-200 font-mono">
            {formatNumber(institution.wavelengthNm)} nm
          </span>
        </div>
      </Card>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-200">Flux vs Time (live)</h2>
            <span className="text-xs text-zinc-500">
              last {Math.min(chartData.length, 60)} samples
            </span>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(63, 63, 70, 0.6)" />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => formatHms(Number(v))}
                  stroke="#a1a1aa"
                />
                <YAxis
                  stroke="#a1a1aa"
                  tickFormatter={(v) =>
                    Number(v) >= 1e6 ? Number(v).toExponential(1) : String(v)
                  }
                />
                <Tooltip
                  labelFormatter={(v) => `UTC ${formatHms(Number(v))}`}
                  contentStyle={{
                    backgroundColor: "#09090b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    color: "#fafafa",
                  }}
                  formatter={(value: any) => [formatNumber(Number(value)), "flux"]}
                />
                <Line
                  type="monotone"
                  dataKey="flux"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Flux is simulated with Gaussian noise and status-dependent attenuation.
          </p>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-200">Live Telemetry Stream</h2>
            <span className="text-xs text-zinc-500">{rows.length} rows</span>
          </div>

          <div
            ref={scrollerRef}
            className="h-[320px] overflow-auto rounded-md border border-zinc-800 bg-zinc-950"
          >
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-950 z-10">
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-2 font-medium text-zinc-400 whitespace-nowrap">
                    timestamp_utc
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-400 whitespace-nowrap">
                    ra (deg)
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-400 whitespace-nowrap">
                    dec (deg)
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-400 whitespace-nowrap">
                    flux
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-400 whitespace-nowrap">
                    SNR
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-400 whitespace-nowrap">
                    status
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-400 whitespace-nowrap">
                    object
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-400 whitespace-nowrap">
                    conf
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isNew = lastRowId === r.id
                  return (
                    <tr
                      key={r.id}
                      className={
                        "border-b border-zinc-900/60 " +
                        (isNew ? "bg-blue-900/25" : "hover:bg-zinc-900/30")
                      }
                    >
                      <td className="py-2 px-2 font-mono text-zinc-300 whitespace-nowrap">
                        {r.timestampUtc}
                      </td>
                      <td className="py-2 px-2 font-mono text-zinc-300">
                        {r.raDeg.toFixed(4)}
                      </td>
                      <td className="py-2 px-2 font-mono text-zinc-300">
                        {r.decDeg.toFixed(4)}
                      </td>
                      <td className="py-2 px-2 font-mono text-zinc-300">
                        {formatNumber(r.flux)}
                      </td>
                      <td className="py-2 px-2 font-mono text-zinc-300">
                        {r.signalToNoise.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-zinc-200">{r.telescopeStatus}</td>
                      <td className="py-2 px-2 text-zinc-200">{r.objectType}</td>
                      <td className="py-2 px-2 font-mono text-zinc-300">
                        {r.confidence.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-zinc-500">
                      Live telemetry initializing…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Rows are appended every 1–3 seconds and pruned to the most recent ~150 entries. This
            stream is in-memory only and does not affect the unified repository.
          </div>
        </Card>
      </div>
    </div>
  )
}

