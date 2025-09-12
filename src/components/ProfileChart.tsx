"use client"

import React, { useId, useMemo } from "react"
import { ClimbData, Config } from "@/lib/types"
import { accumulate, avgGrade, niceStep, toFixedN, unitVec } from "@/lib/utils/math"
import { colorForGrade } from "@/lib/utils/color"
import { fitAxonBoundingRangeCentered } from "@/lib/utils/projection"

/** Pure SVG renderer for the axonometric elevation profile. */
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
    const { canvas, axon, roof, platform, grid } = config
    const segments = data.segments || []
    const { points, totalKm, totalGainM } = accumulate(segments)

    const elevMin = Math.min(...points.map((p) => p.elev))
    const elevMax = Math.max(...points.map((p) => p.elev))
    const elevSpanM = Math.max(10, elevMax - elevMin)

    const Ybuf = Math.max(0, platform.heightM || 0) / 1000 // km
    const W = Math.max(0.001, totalKm)
    const H = elevSpanM / 1000

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

    const proj = fitAxonBoundingRangeCentered(
      W,
      H + Ybuf,
      Math.min(zNear, zFar),
      Math.max(zNear, zFar),
      canvas.width,
      canvas.height,
      canvas.margin,
      axon
    )
    const P = (X: number, Y: number, Z: number) => proj.project(X, Y, Z)

    const worldPts = points.map((p) => ({ X: p.d, Y: (p.elev - elevMin) / 1000 }))

    return {
      canvas,
      grid,
      platform,
      W,
      H,
      Ybuf,
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

  const {
    canvas,
    grid,
    platform,
    W,
    H,
    Ybuf,
    zNear,
    zFar,
    segments,
    worldPts,
    totalKm,
    totalGainM,
    elevSpanM,
    P,
  } = model

  const baseL = P(0, Ybuf, 0),
    baseR = P(W, Ybuf, 0)
  const topPts2D = worldPts.map((pt) => P(pt.X, Ybuf + pt.Y, 0))
  const facePathD = [
    `M ${baseL.x} ${baseL.y}`,
    ...topPts2D.map((q) => `L ${q.x} ${q.y}`),
    `L ${baseR.x} ${baseR.y}`,
    `Z`,
  ].join(" ")

  const distStep = grid.distStepKm || 1
  const stepM = niceStep(elevSpanM, grid.elevLines)
  const stepYkm = stepM / 1000

  const nearPts2D = worldPts.map((pt) => P(pt.X, Ybuf + pt.Y, zNear))
  const farPts2D = worldPts.map((pt) => P(pt.X, Ybuf + pt.Y, zFar))
  const midPts = nearPts2D
    .map((f, i) => {
      const b = farPts2D[i]
      return `${(f.x + b.x) / 2},${(f.y + b.y) / 2}`
    })
    .join(" ")

  const axisL = P(0, 0, 0),
    axisR = P(W, 0, 0)
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
      {/* PLATFORM / SHELF (z = 0 plane) */}
      {Ybuf > 0 && (
        <>
          <path
            d={`M ${P(0, 0, 0).x} ${P(0, 0, 0).y}
                L ${P(0, Ybuf, 0).x} ${P(0, Ybuf, 0).y}
                L ${P(W, Ybuf, 0).x} ${P(W, Ybuf, 0).y}
                L ${P(W, 0, 0).x} ${P(W, 0, 0).y} Z`}
            fill={platform.fill}
          />
          {/* Vertical start wall at x=0 extruded zNear..zFar */}
          <polygon
            points={`${P(0, 0, zNear).x},${P(0, 0, zNear).y}
                     ${P(0, 0, zFar).x},${P(0, 0, zFar).y}
                     ${P(0, Ybuf, zFar).x},${P(0, Ybuf, zFar).y}
                     ${P(0, Ybuf, zNear).x},${P(0, Ybuf, zNear).y}`}
            fill={platform.wallFill}
          />
        </>
      )}

      {/* FRONT FACE (yellow wedge) in z=0 plane */}
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

      {/* GRID (clipped to face) */}
      <g clipPath={`url(#${clipId})`}>
        {/* Distance grid lines */}
        {Array.from({ length: Math.floor(W / distStep) + 2 }, (_, i) => {
          const xk = Math.min(W, i * distStep)
          const p1 = P(xk, 0, 0),
            p2 = P(xk, H + Ybuf, 0)
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
          const yk = Ybuf + i * stepYkm
          const p1 = P(0, yk, 0),
            p2 = P(W, yk, 0)
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

      {/* ROOF / RIBBON tiles + dashed centerline */}
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

      {/* AXES (z=0 plane) */}
      <g fontSize={config.labelFontSize} fontFamily="system-ui, sans-serif" fill="#374151">
        {/* distance axis */}
        <line x1={axisL.x} y1={axisL.y} x2={axisR.x} y2={axisR.y} stroke="#111827" />
        {Array.from({ length: Math.floor(W / distStep) + 1 }, (_, i) => {
          const xk = Math.min(W, i * distStep)
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

        {/* elevation axis at X=W */}
        {(() => {
          const yA = P(W, 0, 0),
            yB = P(W, H + Ybuf, 0)
          const yT = unitVec(yA, yB),
            yN = { x: -yT.y, y: yT.x }
          const step = stepM
          const lines: React.ReactNode[] = [
            <line key="e-line" x1={yA.x} y1={yA.y} x2={yB.x} y2={yB.y} stroke="#111827" />,
          ]
          for (let m = 0; m <= elevSpanM + 1e-6; m += step) {
            const yk = Ybuf + m / 1000
            const p = P(W, yk, 0)
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
