"use client"

import React, { useId, useMemo } from "react"
import { ClimbData, Config } from "@/lib/types"
import { accumulate, avgGrade, niceStep, toFixedN, unitVec } from "@/lib/utils/math"
import { colorForGrade } from "@/lib/utils/color"
import { fitAxonBoundingRangeCentered } from "@/lib/utils/projection"

// Unit conversion constants used across subcomponents
const KM_PER_MI = 1.609344
const FT_PER_M = 3.28084
const FT_PER_KM = FT_PER_M * 1000

/**
 * Axonometric elevation profile (pure SVG).
 * - Shelf/platform is a fixed *pixel* height (config.platform.heightPx).
 * - Terrain (world Y) is exaggerated via the axonometric projector (not the shelf).
 * - The whole composition (world + shelf) is centered by subtracting ½·shelfVec.
 */
export default function ProfileChart({
  data,
  config,
  svgRef,
}: {
  data: ClimbData
  config: Config
  svgRef: React.Ref<SVGSVGElement>
}) {
  const clipId = useId()

  // ────────────────────────────────────────────────────────────────────────────────
  // Derive the model once per data/config change
  // ────────────────────────────────────────────────────────────────────────────────
  const model = useMemo(() => deriveModel(data, config), [data, config])

  const {
    canvas,
    platform,
    segments,
    worldPts,
    totalKm,
    totalGainM,
    elevSpanM,
    elevMin,
    W,
    H,
    zNear,
    zFar,
    P,
    shelfVec,
  } = model

  // Convenience helpers bound to current shelf
  const addShelf = (p: Pt) => addVec(p, shelfVec)
  const shelfLength = Math.hypot(shelfVec.x, shelfVec.y)

  // Base axis (Y=0) projected (already centered via the P() half-shelf shift)
  const baseAxisL = P(0, 0, 0)
  const baseAxisR = P(W, 0, 0)

  // Face path (shelf top → terrain polyline → shelf top)
  const baseL = addShelf(baseAxisL)
  const baseR = addShelf(baseAxisR)
  const topPts2D = worldPts.map((pt) => addShelf(P(pt.X, pt.Y, 0)))
  const facePathD = facePath(baseL, topPts2D, baseR)

  // Units and grid steps
  const isImperial = config.units === "imperial"

  // Distance grid step: provided in user units → convert to world km for spacing
  const distStepLabel = Math.max(1e-6, config.grid.distStep || 1)
  const distStepWorldKm = isImperial ? distStepLabel * KM_PER_MI : distStepLabel

  // Elevation grid step: choose a nice step in label units, then convert to world km
  let stepYkm = 0
  let stepYLabel = 0
  if (isImperial) {
    const elevSpanFt = elevSpanM * FT_PER_M
    const stepFt = niceStep(elevSpanFt, config.grid.elevLines)
    stepYLabel = stepFt // label in feet
    stepYkm = stepFt / FT_PER_KM // world km spacing
  } else {
    const elevSpanKm = H // already in km
    const stepKm = niceStep(elevSpanKm, config.grid.elevLines)
    stepYLabel = stepKm // label in km
    stepYkm = stepKm // world km spacing
  }

  // Roof near/far profiles (both lifted by the shelf)
  const nearPts2D = worldPts.map((pt) => addShelf(P(pt.X, pt.Y, zNear)))
  const farPts2D = worldPts.map((pt) => addShelf(P(pt.X, pt.Y, zFar)))
  const midPts = midPolylineString(nearPts2D, farPts2D)

  // Distance axis tangent/normal (for ticks)
  const tVec = unitVec(baseAxisL, baseAxisR)
  const nVec = { x: -tVec.y, y: tVec.x }

  // Title stats
  const avg = avgGrade(segments)
  const gradeLabelFontSize = Math.max(1, config.labelFontSize * 0.85)

  // ────────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Title and stats rendered outside SVG */}
      <TitleAndStats
        name={data.name}
        titleFontSize={config.titleFontSize}
        units={config.units}
        totalKm={totalKm}
        totalGainM={totalGainM}
        avg={avg}
      />
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        width={canvas.width}
        height={canvas.height}
        role="img"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      >
        {/* ── PLATFORM / SHELF (fixed pixel height in screen space) ── */}
        {platform.heightPx > 0 && (
          <>
            {(() => {
              // bottom edge (distance axis at Y=0), top edge is bottom + shelfVec
              const p00 = P(0, 0, 0)
              const p10 = P(W, 0, 0)
              const p01 = addShelf(p00)
              const p11 = addShelf(p10)
              return (
                <>
                  {/* Shelf slab */}
                  <path
                    d={`M ${p00.x} ${p00.y} L ${p01.x} ${p01.y} L ${p11.x} ${p11.y} L ${p10.x} ${p10.y} Z`}
                    fill={platform.fill}
                  />
                  {/* Vertical start wall at x=0 extruded along z and lifted by the shelf */}
                  <polygon
                    points={`${P(0, 0, zNear).x},${P(0, 0, zNear).y}
                           ${P(0, 0, zFar).x},${P(0, 0, zFar).y}
                           ${addShelf(P(0, 0, zFar)).x},${addShelf(P(0, 0, zFar)).y}
                           ${addShelf(P(0, 0, zNear)).x},${addShelf(P(0, 0, zNear)).y}`}
                    fill={platform.wallFill}
                  />
                </>
              )
            })()}
          </>
        )}

        {/* ── FRONT FACE (yellow wedge) at z=0, lifted by shelf ── */}
        <defs>
          <clipPath id={clipId}>
            <path d={facePathD} />
          </clipPath>
        </defs>
        <path
          d={facePathD}
          fill="var(--face-yellow)"
          stroke={config.face.stroke}
          strokeWidth={config.face.strokeWidth}
        />

        {/* ── GRID (clipped to face). Lines are lifted by the shelf ── */}
        <g clipPath={`url(#${clipId})`}>
          {/* Distance grid lines */}
          {Array.from({ length: Math.floor(W / distStepWorldKm) + 2 }, (_, i) => {
            const xk = Math.min(W, i * distStepWorldKm)
            const p1 = addShelf(P(xk, 0, 0))
            const p2 = addShelf(P(xk, H, 0))
            return (
              <line
                key={`gx-${i}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="var(--grid)"
                strokeWidth={1}
                strokeDasharray="4 8"
              />
            )
          })}
          {/* Elevation grid lines (from shelf top) */}
          {Array.from({ length: Math.floor(H / stepYkm) + 2 }, (_, i) => {
            const yk = i * stepYkm
            const p1 = addShelf(P(0, yk, 0))
            const p2 = addShelf(P(W, yk, 0))
            return (
              <line
                key={`gy-${i}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="var(--grid)"
                strokeWidth={1}
                strokeDasharray="8 8"
              />
            )
          })}
        </g>

        {/* ── ROOF / RIBBON (tiles + dashed midline), lifted by the shelf ── */}
        <g>
          {worldPts.slice(0, -1).map((_, i) => {
            const a = nearPts2D[i],
              b = nearPts2D[i + 1]
            const a2 = farPts2D[i],
              b2 = farPts2D[i + 1]
            const grade = segments[i]?.grade ?? 0
            return (
              <polygon
                key={`tile-${i}`}
                points={`${a.x},${a.y} ${b.x},${b.y} ${b2.x},${b2.y} ${a2.x},${a2.y}`}
                fill={colorForGrade(grade, config.slopeColors)}
                stroke="var(--road-stroke)"
                strokeWidth={0.9}
              />
            )
          })}
          <polyline
            points={midPts}
            fill="none"
            stroke="var(--centerline)"
            strokeWidth={config.road.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={config.road.dash}
          />
        </g>

        {/* ── AXES (distance at Y=0; elevation at X=W lifted by shelf) ── */}
        <g fontSize={config.labelFontSize} fontFamily="system-ui, sans-serif" fill="#374151">
          {/* distance axis */}
          <line
            x1={baseAxisL.x}
            y1={baseAxisL.y}
            x2={baseAxisR.x}
            y2={baseAxisR.y}
            stroke="#111827"
          />
          {segments.map((segment, i) => {
            const start = worldPts[i]
            const end = worldPts[i + 1]
            if (!start || !end) return null
            if ((segment?.km || 0) <= 0) return null

            const midX = (start.X + end.X) / 2
            const basePoint = P(midX, 0, 0)
            const shelfFraction = 0.68
            const offset =
              shelfLength > 1e-6
                ? { x: shelfVec.x * shelfFraction, y: shelfVec.y * shelfFraction }
                : { x: nVec.x * 18, y: nVec.y * 18 }
            const pos = { x: basePoint.x + offset.x, y: basePoint.y + offset.y }

            const grade = segment.grade ?? 0
            const gradeValue = Number.isFinite(grade) ? Math.round(grade) : 0

            return (
              <text
                key={`grade-${i}`}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight={600}
                fontSize={gradeLabelFontSize}
                fill="#111827"
              >
                {`${gradeValue}%`}
              </text>
            )
          })}
          {Array.from({ length: Math.floor(W / distStepWorldKm) + 1 }, (_, i) => {
            const xk = Math.min(W, i * distStepWorldKm)
            const p = P(xk, 0, 0)
            return (
              <g key={`dx-${i}`}>
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={p.x + nVec.x * 8}
                  y2={p.y + nVec.y * 8}
                  stroke="#111827"
                />
                <text x={p.x + nVec.x * 18} y={p.y + nVec.y * 18} textAnchor="middle">
                  {(() => {
                    const labelVal = i * distStepLabel
                    return labelVal % 1 === 0 ? labelVal : toFixedN(labelVal, 1)
                  })()}
                </text>
              </g>
            )
          })}
          <text
            x={(baseAxisL.x + baseAxisR.x) / 2 + nVec.x * 32}
            y={(baseAxisL.y + baseAxisR.y) / 2 + nVec.y * 32}
            fill="#6b7280"
            textAnchor="middle"
          >
            {`Distance (${isImperial ? "mi" : "km"})`}
          </text>

          {/* elevation axis at X=W (lifted by shelf) */}
          {(() => {
            const yA = addShelf(P(W, 0, 0))
            const yB = addShelf(P(W, H, 0))
            const yT = unitVec(yA, yB)
            const yN = { x: -yT.y, y: yT.x }
            const lines: React.ReactNode[] = [
              <line key="e-line" x1={yA.x} y1={yA.y} x2={yB.x} y2={yB.y} stroke="#111827" />,
            ]
            {
              const maxTicks = Math.floor(H / stepYkm + 1e-6) + 1

              // If a starting elevation (absolute, meters) is provided, offset labels from it.
              // Bottom of the world (Y=0) corresponds to the relative min elevation (elevMin).
              // So the absolute elevation at Y=0 is: startElevM + elevMin. If no start provided, use 0 (current behavior).
              const startElevM = data.startElevM
              const baseAbsLabel = (() => {
                if (startElevM == null) return 0
                const absAtBottomM = startElevM + elevMin // meters
                return isImperial ? absAtBottomM * FT_PER_M : absAtBottomM / 1000
              })()

              for (let i = 0; i <= maxTicks; i++) {
                const yk = i * stepYkm
                if (yk > H + 1e-6) break
                const p = addShelf(P(W, yk, 0))
                const labelVal = baseAbsLabel + i * stepYLabel
                const labelStr = isImperial
                  ? `${Math.round(labelVal)} ft`
                  : `${labelVal % 1 === 0 ? labelVal : toFixedN(labelVal, 1)} km`
                lines.push(
                  <g key={`ey-${i}`}>
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={p.x + yN.x * 6}
                      y2={p.y + yN.y * 6}
                      stroke="#111827"
                    />
                    <text x={p.x + yN.x * 14} y={p.y + yN.y * 14}>
                      {labelStr}
                    </text>
                  </g>
                )
              }
            }
            return lines
          })()}
        </g>

        <GradeLegend
          canvas={canvas}
          slopeColors={config.slopeColors}
          labelFontSize={config.labelFontSize}
        />
      </svg>
    </>
  )
}

function GradeLegend({
  canvas,
  slopeColors,
  labelFontSize,
}: {
  canvas: Config["canvas"]
  slopeColors: Config["slopeColors"]
  labelFontSize: number
}) {
  const legendItems = useMemo(() => {
    const buckets = slopeColors || []
    if (buckets.length === 0) return [] as { color: string; label: string }[]

    const formatBound = (value: number) => {
      if (!Number.isFinite(value)) return "∞"
      const sanitized = Math.abs(value) < 1e-6 ? 0 : value
      const rounded = Math.round(sanitized)
      return Math.abs(rounded - sanitized) < 1e-6 ? `${rounded}` : `${toFixedN(sanitized, 1)}`
    }

    const items: { color: string; label: string }[] = []
    let previousUpper: number | null = null

    for (const bucket of buckets) {
      const lowerBound = previousUpper ?? Math.min(0, bucket.upTo)
      const safeLower = Number.isFinite(lowerBound) ? lowerBound : 0
      const label = Number.isFinite(bucket.upTo)
        ? `${formatBound(safeLower)}-${formatBound(bucket.upTo)}%`
        : `${formatBound(safeLower)}%+`
      items.push({ color: bucket.color, label })
      previousUpper = bucket.upTo
    }

    return items
  }, [slopeColors])

  if (!legendItems.length) return null

  // Inline, bottom-centered legend layout
  const legendSwatchSize = 16
  const gapSwatchToText = 10
  const gapBetweenItems = 20
  const gapAfterTitle = 14

  // Approximate text width in pixels (simple heuristic)
  const approxTextWidth = (text: string) => Math.ceil(text.length * labelFontSize * 0.6)

  // Compute total width to center the whole legend row
  const titleText = "Grade:"
  const titleWidth = approxTextWidth(titleText)
  const itemsWidth = legendItems.reduce((sum, it, idx) => {
    const textW = approxTextWidth(it.label)
    const itemW = legendSwatchSize + gapSwatchToText + textW
    return sum + itemW + (idx < legendItems.length - 1 ? gapBetweenItems : 0)
  }, 0)
  const totalWidth = titleWidth + gapAfterTitle + itemsWidth
  const startX = canvas.width / 2 - totalWidth / 2
  const baselineY = canvas.height - canvas.margin.bottom + 20

  return (
    <g transform={`translate(0, 0)`} fontFamily="system-ui, sans-serif" fontSize={labelFontSize}>
      {/* Title at start of the row */}
      <text x={startX} y={baselineY} fontWeight={700} fill="#111827" dominantBaseline="middle">
        {titleText}
      </text>
      {(() => {
        // Lay out items from left to right starting after the title
        let cursorX = startX + titleWidth + gapAfterTitle
        return legendItems.map((item, idx) => {
          const textW = approxTextWidth(item.label)
          const groupX = cursorX
          const swatchX = groupX
          const textX = groupX + legendSwatchSize + gapSwatchToText
          const gapAfter = idx < legendItems.length - 1 ? gapBetweenItems : 0
          cursorX += legendSwatchSize + gapSwatchToText + textW + gapAfter // advance cursor for next item
          return (
            <g key={`legend-${idx}`}>
              <rect
                x={swatchX}
                y={baselineY - legendSwatchSize / 2}
                width={legendSwatchSize}
                height={legendSwatchSize}
                fill={item.color}
                stroke="#111827"
                strokeWidth={0.6}
                rx={3}
                ry={3}
              />
              <text x={textX} y={baselineY} fill="#111827" dominantBaseline="middle">
                {item.label}
              </text>
            </g>
          )
        })
      })()}
    </g>
  )
}

function TitleAndStats({
  name,
  titleFontSize,
  units,
  totalKm,
  totalGainM,
  avg,
}: {
  name?: string
  titleFontSize: number
  units: Config["units"]
  totalKm: number
  totalGainM: number
  avg: number
}) {
  const isImperial = units === "imperial"

  const distVal = isImperial ? totalKm / KM_PER_MI : totalKm
  const distStr = `${toFixedN(distVal, 1)} ${isImperial ? "mi" : "km"}`

  const gainVal = isImperial ? Math.round(totalGainM * FT_PER_M) : toFixedN(totalGainM / 1000, 1)
  const gainStr = `${gainVal} ${isImperial ? "ft" : "km"} gain`

  return (
    <div style={{ textAlign: "center", marginBottom: 8 }}>
      <div
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: titleFontSize,
          fontWeight: 800,
          color: "var(--ink)",
          lineHeight: 1.1,
        }}
      >
        {name || "Climb"}
      </div>
      <div style={{ color: "var(--muted)", marginTop: 4 }}>
        {`${distStr} • ${gainStr} • ${toFixedN(avg, 1)}% avg`}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────────
 * Small helpers (kept in this file for readability and locality)
 * ─────────────────────────────────────────────────────────────────────────────── */

type Pt = { x: number; y: number }

// Internal model returned by deriveModel()
type Model = {
  canvas: Config["canvas"]
  platform: Config["platform"]
  segments: ClimbData["segments"]
  worldPts: { X: number; Y: number }[]
  totalKm: number
  totalGainM: number
  elevSpanM: number
  elevMin: number
  W: number
  H: number
  zNear: number
  zFar: number
  P: (X: number, Y: number, Z: number) => Pt
  shelfVec: Pt
}

/**
 * Derive the rendering model from input data and config.
 * This was previously inline in a useMemo within ProfileChart.
 */
function deriveModel(data: ClimbData, config: Config): Model {
  const { canvas, axon, roof, platform } = config
  const segments = data.segments || []
  const { points, totalKm, totalGainM } = accumulate(segments)

  // Relative elevation span (m → km for world Y)
  const elevMin = Math.min(...points.map((p) => p.elev))
  const elevMax = Math.max(...points.map((p) => p.elev))
  const elevSpanM = Math.max(10, elevMax - elevMin)

  // World extents (NO shelf in world space)
  const W = Math.max(0.001, totalKm) // km (X world)
  const H = elevSpanM / 1000 // km (Y world)

  // Ribbon Z placement along [zNear .. zFar]
  const { zNear, zFar } = computeRoofZBounds(roof, W)

  // Reserve shelf pixels in the fit so adding it later won't clip anything.
  const fitHeight = canvas.height - (platform.heightPx || 0)

  // Projector that fits + centers the world box (no shelf) in the available area.
  const proj = fitAxonBoundingRangeCentered(
    W,
    H,
    Math.min(zNear, zFar),
    Math.max(zNear, zFar),
    canvas.width,
    fitHeight,
    canvas.margin,
    axon
  )
  const P0 = (X: number, Y: number, Z: number) => proj.project(X, Y, Z)

  // Shelf vector in screen space: direction of +Y (world) mapped through projector,
  // normalized and scaled to exactly platform.heightPx.
  const shelfVec = shelfVectorPx(P0, platform.heightPx || 0)

  // Center the total composition (world + shelf) by subtracting ½·shelfVec for every point.
  const halfShelf = { x: shelfVec.x / 2, y: shelfVec.y / 2 }
  const P = (X: number, Y: number, Z: number) => subVec(P0(X, Y, Z), halfShelf)

  // Relative world points (km, km). Elevation becomes Y in km above elevMin.
  const worldPts = points.map((p) => ({ X: p.d, Y: (p.elev - elevMin) / 1000 }))

  return {
    canvas,
    platform,
    segments,
    worldPts,
    totalKm,
    totalGainM,
    elevSpanM,
    elevMin,
    W,
    H,
    zNear,
    zFar,
    P,
    shelfVec,
  }
}

function computeRoofZBounds(roof: Config["roof"], W: number): { zNear: number; zFar: number } {
  const Dbase = Math.max(0.01, roof.depthOverrideKm ?? W * roof.depthFrac)
  let zNear: number
  switch (roof.anchor) {
    case "front":
      zNear = 0 + (roof.zOffsetKm || 0)
      break // [0, D]
    case "back":
      zNear = -Dbase + (roof.zOffsetKm || 0)
      break // [-D, 0]
    default:
      zNear = -Dbase / 2 + (roof.zOffsetKm || 0) // [-D/2, +D/2]
  }
  return { zNear, zFar: zNear + Dbase }
}

/** Compute a screen-space vector equal to +Y (world) turned into exactly heightPx pixels. */
function shelfVectorPx(project: (X: number, Y: number, Z: number) => Pt, heightPx: number): Pt {
  const a = project(0, 0, 0)
  const b = project(0, 1, 0)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: (dx / len) * heightPx, y: (dy / len) * heightPx }
}

function addVec(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y }
}
function subVec(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y }
}

/** Build a closed path d-string: baseL → top polyline → baseR → close. */
function facePath(baseL: Pt, top: Pt[], baseR: Pt): string {
  return [
    `M ${baseL.x} ${baseL.y}`,
    ...top.map((q) => `L ${q.x} ${q.y}`),
    `L ${baseR.x} ${baseR.y}`,
    `Z`,
  ].join(" ")
}

/** String of midpoints between two polylines (same length) for the dashed centerline. */
function midPolylineString(a: Pt[], b: Pt[]): string {
  const n = Math.min(a.length, b.length)
  const parts = new Array<string>(n)
  for (let i = 0; i < n; i++) {
    parts[i] = `${(a[i].x + b[i].x) / 2},${(a[i].y + b[i].y) / 2}`
  }
  return parts.join(" ")
}
