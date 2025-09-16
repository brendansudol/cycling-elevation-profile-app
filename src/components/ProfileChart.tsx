"use client"

import React, { useId, useMemo } from "react"
import { ClimbData, Config } from "@/lib/types"
import { accumulate, avgGrade, niceStep, toFixedN, unitVec } from "@/lib/utils/math"
import { colorForGrade } from "@/lib/utils/color"
import { fitAxonBoundingRangeCentered } from "@/lib/utils/projection"

/**
 * Axonometric elevation profile (pure SVG).
 * This version uses a fixed-pixel shelf (platform.heightPx) and keeps the
 * overall graphic perfectly centered by subtracting ½·shelfVec from the
 * projector translation.
 */
export default function ProfileChart({
  data,
  config,
  svgRef,
}: {
  data: ClimbData
  config: Config
  svgRef: React.RefObject<SVGSVGElement | null>
}) {
  const clipId = useId()

  // Derived geometry (memoized)
  const model = useMemo(() => {
    const { canvas, axon, roof, platform } = config
    const segments = data.segments || []
    const { points, totalKm, totalGainM } = accumulate(segments)

    const elevMin = Math.min(...points.map((p) => p.elev))
    const elevMax = Math.max(...points.map((p) => p.elev))
    const elevSpanM = Math.max(10, elevMax - elevMin)

    // World extents (NO shelf in world space)
    const W = Math.max(0.001, totalKm) // km (X world)
    const H = elevSpanM / 1000 // km (Y world)

    // Ribbon thickness from fraction or fixed override
    const Dbase = Math.max(0.01, roof.depthOverrideKm ?? W * roof.depthFrac)
    let zNear: number
    switch (roof.anchor) {
      case "front":
        zNear = 0 + (roof.zOffsetKm || 0)
        break
      case "back":
        zNear = -Dbase + (roof.zOffsetKm || 0)
        break
      default:
        zNear = -Dbase / 2 + (roof.zOffsetKm || 0)
    }
    const zFar = zNear + Dbase

    // Reserve the shelf pixels in fit so nothing clips after we lift the face by shelfVec
    const fitHeight = canvas.height - (platform.heightPx || 0)

    // Build projector that fits the world box (no shelf) into fitHeight and centers it.
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

    // We'll compute shelfVec in screen-space as: direction of +Y (world) mapped through projector,
    // normalized and scaled to exactly platform.heightPx.
    const P0 = (X: number, Y: number, Z: number) => proj.project(X, Y, Z)

    const pY0 = P0(0, 0, 0)
    const pY1 = P0(0, 1, 0)
    const ydx = pY1.x - pY0.x,
      ydy = pY1.y - pY0.y
    const ylen = Math.hypot(ydx, ydy) || 1
    const shelfVec = {
      x: (ydx / ylen) * (platform.heightPx || 0),
      y: (ydy / ylen) * (platform.heightPx || 0),
    }

    // Center the overall graphic (world + shelf) by subtracting ½·shelfVec
    const P = (X: number, Y: number, Z: number) => {
      const p = P0(X, Y, Z)
      return { x: p.x - shelfVec.x / 2, y: p.y - shelfVec.y / 2 }
    }

    // Data in world units (relative elevation)
    const worldPts = points.map((p) => ({ X: p.d, Y: (p.elev - elevMin) / 1000 }))

    return {
      canvas,
      roof,
      platform,
      W,
      H,
      zNear,
      zFar,
      segments,
      worldPts,
      totalKm,
      totalGainM,
      elevSpanM,
      elevMin,
      P,
      shelfVec,
    }
  }, [data, config])

  const {
    canvas,
    platform,
    W,
    H,
    zNear,
    zFar,
    segments,
    worldPts,
    totalKm,
    totalGainM,
    elevSpanM,
    elevMin,
    P,
    shelfVec,
  } = model

  // Small helpers
  const addShelf = (p: { x: number; y: number }) => ({ x: p.x + shelfVec.x, y: p.y + shelfVec.y })

  // Base axis (Y=0) projected (already centered by -½·shelfVec)
  const baseAxisL = P(0, 0, 0),
    baseAxisR = P(W, 0, 0)

  // Face top follows the terrain and is lifted by shelfVec
  const baseL = addShelf(baseAxisL)
  const baseR = addShelf(baseAxisR)
  const topPts2D = worldPts.map((pt) => addShelf(P(pt.X, pt.Y, 0)))

  const facePathD = [
    `M ${baseL.x} ${baseL.y}`,
    ...topPts2D.map((q) => `L ${q.x} ${q.y}`),
    `L ${baseR.x} ${baseR.y}`,
    `Z`,
  ].join(" ")

  // Grid steps
  const distStep = config.grid.distStepKm || 1
  const stepM = niceStep(elevSpanM, config.grid.elevLines)
  const stepYkm = stepM / 1000

  const axisMinM = (data.startElevationM ?? 0) + elevMin

  // Roof near/far profiles (also lifted by shelfVec)
  const nearPts2D = worldPts.map((pt) => addShelf(P(pt.X, pt.Y, zNear)))
  const farPts2D = worldPts.map((pt) => addShelf(P(pt.X, pt.Y, zFar)))
  const midPts = nearPts2D
    .map((f, i) => {
      const b = farPts2D[i]
      return `${(f.x + b.x) / 2},${(f.y + b.y) / 2}`
    })
    .join(" ")

  // Axes helpers (distance axis remains on Y=0, i.e., *below* the shelf)
  const axisL = baseAxisL,
    axisR = baseAxisR
  const tVec = unitVec(axisL, axisR)
  const nVec = { x: -tVec.y, y: tVec.x }

  const avg = avgGrade(segments)
  const centerX = canvas.width / 2

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      width={canvas.width}
      height={canvas.height}
      role="img"
    >
      {/* PLATFORM / SHELF — fixed pixel height (screen-space) */}
      {platform.heightPx > 0 && (
        <>
          {(() => {
            const p00 = P(0, 0, 0)
            const p10 = P(W, 0, 0) // bottom (x-axis)
            const p01 = addShelf(p00)
            const p11 = addShelf(p10) // top (shelf top)

            return (
              <>
                <path
                  d={`M ${p00.x} ${p00.y} L ${p01.x} ${p01.y} L ${p11.x} ${p11.y} L ${p10.x} ${p10.y} Z`}
                  fill={platform.fill}
                />
                {/* Vertical start wall at x=0 extruded along z and lifted by shelfVec */}
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

      {/* FRONT FACE (yellow wedge) in z=0 plane (lifted by shelfVec) */}
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

      {/* GRID (clipped to face). Lines are lifted by shelfVec. */}
      <g clipPath={`url(#${clipId})`}>
        {/* Distance grid lines */}
        {Array.from({ length: Math.floor(W / distStep) + 2 }, (_, i) => {
          const xk = Math.min(W, i * distStep)
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

      {/* ROOF / RIBBON tiles + dashed centerline (lifted by shelfVec) */}
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

      {/* AXES (z=0 plane).
          Distance axis stays at Y=0 (below shelf), elevation axis is lifted by shelfVec. */}
      <g fontSize={config.labelFontSize} fontFamily="system-ui, sans-serif" fill="#374151">
        {/* distance axis */}
        <line x1={axisL.x} y1={axisL.y} x2={axisR.x} y2={axisR.y} stroke="#111827" />
        {Array.from({ length: Math.floor(W / (config.grid.distStepKm || 1)) + 1 }, (_, i) => {
          const xk = Math.min(W, i * (config.grid.distStepKm || 1))
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
                {xk % 1 === 0 ? xk : toFixedN(xk, 1)}
              </text>
            </g>
          )
        })}
        <text
          x={(axisL.x + axisR.x) / 2 + nVec.x * 32}
          y={(axisL.y + axisR.y) / 2 + nVec.y * 32}
          fill="#6b7280"
          textAnchor="middle"
        >
          Distance (km)
        </text>

        {/* elevation axis at X=W (lifted by shelfVec) */}
        {(() => {
          const yA = addShelf(P(W, 0, 0)),
            yB = addShelf(P(W, H, 0))
          const yT = unitVec(yA, yB),
            yN = { x: -yT.y, y: yT.x }
          const step = stepM
          const lines: React.ReactNode[] = [
            <line key="e-line" x1={yA.x} y1={yA.y} x2={yB.x} y2={yB.y} stroke="#111827" />,
          ]
          for (let m = 0; m <= elevSpanM + 1e-6; m += step) {
            const yk = m / 1000
            const p = addShelf(P(W, yk, 0))
            lines.push(
              <g key={`ey-${m}`}>
                <line x1={p.x} y1={p.y} x2={p.x + yN.x * 6} y2={p.y + yN.y * 6} stroke="#111827" />
                <text x={p.x + yN.x * 14} y={p.y + yN.y * 14}>
                  {Math.round(axisMinM + m)} m
                </text>
              </g>
            )
          }
          return lines
        })()}
      </g>

      {/* Title */}
      <g fontFamily="system-ui, sans-serif" textAnchor="middle">
        <text x={centerX} y={34} fontSize={config.titleFontSize} fontWeight={800} fill="#111827">
          {data.name || "Climb"}
        </text>
        <text x={centerX} y={60} fill="#6b7280">
          {`${toFixedN(totalKm, 1)} km • ${totalGainM} m gain • ${toFixedN(avg, 1)}% avg`}
        </text>
      </g>
    </svg>
  )
}
