// components/ProfileChart.tsx
"use client"

import React, { useId, useMemo } from "react"
import { ClimbData, Config } from "@/lib/types"
import { accumulate, avgGrade, niceStep, toFixedN, unitVec } from "@/lib/utils/math"
import { colorForGrade } from "@/lib/utils/color"
import { fitAxonBoundingRangeCentered } from "@/lib/utils/projection"

type Props = {
  data: ClimbData
  config: Config
  svgRef: React.RefObject<SVGSVGElement | null>
}

/** Helper add-vector */
const add = (p: { x: number; y: number }, v: { x: number; y: number }) => ({
  x: p.x + v.x,
  y: p.y + v.y,
})

/** Pure SVG renderer for the axonometric elevation profile. */
export default function ProfileChart({ data, config, svgRef }: Props) {
  const clipId = useId()

  // ——— Derived geometry (memoized) ————————————————
  const model = useMemo(() => {
    const { canvas, axon, roof } = config
    const segments = data.segments || []
    const { points, totalKm, totalGainM } = accumulate(segments)

    const elevMin = Math.min(...points.map((p) => p.elev))
    const elevMax = Math.max(...points.map((p) => p.elev))
    const elevSpanM = Math.max(10, elevMax - elevMin)

    // World sizes (terrain only; shelf is handled in screen space)
    const W = Math.max(0.001, totalKm) // km in X
    const H = elevSpanM / 1000 // km in Y

    // Ribbon thickness from fraction or fixed override
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
        zNear = -Dbase / 2 + (roof.zOffsetKm || 0)
    }
    const zFar = zNear + Dbase

    // Projector that fits + centers the TERRAIN (no shelf) inside the inner area
    const proj = fitAxonBoundingRangeCentered(
      W,
      H,
      Math.min(zNear, zFar),
      Math.max(zNear, zFar),
      canvas.width,
      canvas.height,
      canvas.margin,
      config.axon
    )
    const P = (X: number, Y: number, Z: number) => proj.project(X, Y, Z)

    // World points (km) for the terrain
    const worldPts = points.map((p) => ({ X: p.d, Y: (p.elev - elevMin) / 1000 }))

    return {
      canvas,
      W,
      H,
      zNear,
      zFar,
      segments,
      worldPts,
      totalKm,
      totalGainM,
      elevSpanM,
      P,
    }
  }, [data, config])

  const { canvas, W, H, zNear, zFar, segments, worldPts, totalKm, totalGainM, elevSpanM, P } = model

  // ——— Compute a fixed-pixel shelf vector along the projected +Y direction ———
  const vY = { x: P(0, 1, 0).x - P(0, 0, 0).x, y: P(0, 1, 0).y - P(0, 0, 0).y } // screen delta for +1 km Y
  const vYlen = Math.hypot(vY.x, vY.y) || 1
  const shelfPx = config.platform.pixelHeight
  const shelfVec = { x: (vY.x / vYlen) * shelfPx, y: (vY.y / vYlen) * shelfPx }

  // Centering correction: include shelf in centering by shifting everything by -½·shelfVec
  const C = { x: -shelfVec.x / 2, y: -shelfVec.y / 2 }

  // ——— Precompute projected points ————————————————
  // Baseline (Y=0) endpoints (no shelf offset; apply centering correction C only)
  const baseL = add(P(0, 0, 0), C)
  const baseR = add(P(W, 0, 0), C)

  // Face path (offset by shelfVec + C)
  const baseLShift = add(baseL, shelfVec)
  const baseRShift = add(baseR, shelfVec)
  const topPts2D = worldPts.map((pt) => add(P(pt.X, pt.Y, 0), add(C, shelfVec)))
  const facePathD = [
    `M ${baseLShift.x} ${baseLShift.y}`,
    ...topPts2D.map((q) => `L ${q.x} ${q.y}`),
    `L ${baseRShift.x} ${baseRShift.y}`,
    `Z`,
  ].join(" ")

  // Grid steps
  const distStep = config.grid.distStepKm || 1
  const stepM = niceStep(elevSpanM, config.grid.elevLines)
  const stepYkm = stepM / 1000

  // Roof near/far polylines (shift by shelfVec + C)
  const nearPts2D = worldPts.map((pt) => add(P(pt.X, pt.Y, zNear), add(C, shelfVec)))
  const farPts2D = worldPts.map((pt) => add(P(pt.X, pt.Y, zFar), add(C, shelfVec)))
  const midPts = nearPts2D
    .map((f, i) => {
      const b = farPts2D[i]
      return `${(f.x + b.x) / 2},${(f.y + b.y) / 2}`
    })
    .join(" ")

  // Axes helpers (distance axis on baseline; elevation axis shifted by shelfVec)
  const axisL = baseL // P(0,0,0) + C
  const axisR = baseR // P(W,0,0) + C
  const tVec = unitVec(axisL, axisR)
  const nVec = { x: -tVec.y, y: tVec.x }

  const centerX = canvas.width / 2
  const avg = avgGrade(segments)

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      width={canvas.width}
      height={canvas.height}
      role="img"
    >
      {/* PLATFORM / SHELF: rectangle between baseline and baseline + shelfVec */}
      <>
        {/* top-edge points */}
        {/* bottom-edge points are baseL/baseR */}
        <path
          d={`M ${baseL.x} ${baseL.y}
              L ${add(P(0, 0, 0), add(C, shelfVec)).x} ${add(P(0, 0, 0), add(C, shelfVec)).y}
              L ${add(P(W, 0, 0), add(C, shelfVec)).x} ${add(P(W, 0, 0), add(C, shelfVec)).y}
              L ${baseR.x} ${baseR.y} Z`}
          fill={config.platform.fill}
        />
        {/* Start wall at x=0 extruded across ribbon zNear..zFar (bottom edge at baseline, top at +shelfVec) */}
        <polygon
          points={`${add(P(0, 0, zNear), C).x},${add(P(0, 0, zNear), C).y}
                   ${add(P(0, 0, zFar), C).x},${add(P(0, 0, zFar), C).y}
                   ${add(P(0, 0, zFar), add(C, shelfVec)).x},${
            add(P(0, 0, zFar), add(C, shelfVec)).y
          }
                   ${add(P(0, 0, zNear), add(C, shelfVec)).x},${
            add(P(0, 0, zNear), add(C, shelfVec)).y
          }`}
          fill={config.platform.wallFill}
        />
      </>

      {/* FRONT FACE (yellow wedge) in z=0 plane, shifted by shelfVec */}
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

      {/* GRID (clipped to face, shifted by shelfVec) */}
      <g clipPath={`url(#${clipId})`}>
        {/* Distance grid lines */}
        {Array.from({ length: Math.floor(W / distStep) + 2 }, (_, i) => {
          const xk = Math.min(W, i * distStep)
          const p1 = add(P(xk, 0, 0), add(C, shelfVec))
          const p2 = add(P(xk, H, 0), add(C, shelfVec))
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
          const p1 = add(P(0, yk, 0), add(C, shelfVec))
          const p2 = add(P(W, yk, 0), add(C, shelfVec))
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

      {/* ROOF / RIBBON tiles + dashed centerline (shifted by shelfVec) */}
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

      {/* AXES */}
      <g fontSize={config.labelFontSize} fontFamily="system-ui, sans-serif" fill="#374151">
        {/* Distance axis: baseline (no shelf offset) */}
        <line x1={axisL.x} y1={axisL.y} x2={axisR.x} y2={axisR.y} stroke="#111827" />
        {Array.from({ length: Math.floor(W / distStep) + 1 }, (_, i) => {
          const xk = Math.min(W, i * distStep)
          const p = add(P(xk, 0, 0), C)
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

        {/* Elevation axis at X=W: start at shelf top, run to terrain top (both shifted by shelfVec) */}
        {(() => {
          const yA = add(P(W, 0, 0), add(C, shelfVec)) // shelf top at X=W
          const yB = add(P(W, H, 0), add(C, shelfVec)) // terrain top at X=W
          const yT = unitVec(yA, yB),
            yN = { x: -yT.y, y: yT.x }
          const lines: React.ReactNode[] = [
            <line key="e-line" x1={yA.x} y1={yA.y} x2={yB.x} y2={yB.y} stroke="#111827" />,
          ]
          for (let m = 0; m <= elevSpanM + 1e-6; m += stepM) {
            const yk = m / 1000
            const p = add(P(W, yk, 0), add(C, shelfVec))
            lines.push(
              <g key={`ey-${m}`}>
                <line x1={p.x} y1={p.y} x2={p.x + yN.x * 6} y2={p.y + yN.y * 6} stroke="#111827" />
                <text x={p.x + yN.x * 14} y={p.y + yN.y * 14}>
                  {m | 0} m
                </text>
              </g>
            )
          }
          return lines
        })()}
      </g>

      {/* Title (centered on full canvas; unchanged) */}
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
