import { Segment } from "../types"

export const toFixedN = (v: number, n: number) => (Number.isFinite(v) ? Number(v.toFixed(n)) : v)

export function accumulate(segments: Segment[]) {
  const pts: { d: number; elev: number }[] = [{ d: 0, elev: 0 }]
  let d = 0,
    elev = 0,
    gain = 0
  for (const s of segments) {
    const len = Math.max(0, +s.km || 0)
    const g = +s.grade || 0
    d += len
    const rise = len * g * 10 // 1 km @ 7% = 70 m
    elev += rise
    if (rise > 0) gain += rise
    pts.push({ d, elev })
  }
  return { points: pts, totalKm: d, totalGainM: Math.round(gain) }
}

export function niceStep(range: number, maxTicks: number) {
  const rough = range / Math.max(1, maxTicks)
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)))
  const cand = [1, 2, 2.5, 5, 10].map((m) => m * pow10)
  return cand.reduce(
    (best, v) => (Math.abs(v - rough) < Math.abs(best - rough) ? v : best),
    cand[0]
  )
}

export function unitVec(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x,
    dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

export function avgGrade(segments: Segment[]) {
  const dist = segments.reduce((s, r) => s + (+r.km || 0), 0) || 1
  const rise = segments.reduce((s, r) => s + (+r.km || 0) * (+r.grade || 0) * 10, 0)
  return (rise / (dist * 1000)) * 100
}
