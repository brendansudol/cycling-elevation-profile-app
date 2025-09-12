import { AxonParams } from "../types"

const DEG = (d: number) => (d * Math.PI) / 180

/** 3D → 2D orthographic projector (yaw→pitch→roll). Y scaled by verticalExaggeration. */
function axonProject(X: number, Y: number, Z: number, params: AxonParams) {
  const Xs = X * (params.xScale ?? 1)
  const Ys = Y * (params.verticalExaggeration ?? 1)
  const Zs = Z

  // Ry(yaw)
  const cy = Math.cos(DEG(params.yawDeg))
  const sy = Math.sin(DEG(params.yawDeg))
  const x1 = cy * Xs + sy * Zs
  const y1 = Ys
  const z1 = -sy * Xs + cy * Zs

  // Rx(pitch)
  const cp = Math.cos(DEG(params.pitchDeg))
  const sp = Math.sin(DEG(params.pitchDeg))
  const x2 = x1
  const y2 = cp * y1 - sp * z1
  const z2 = sp * y1 + cp * z1

  // Rz(roll)
  const cr = Math.cos(DEG(params.rollDeg))
  const sr = Math.sin(DEG(params.rollDeg))
  const xp = cr * x2 - sr * y2
  const yp = sr * x2 + cr * y2

  return { x: xp, y: yp }
}

/** Fit world box (W×H, zMin..zMax) into canvas and center inside the inner area. */
export function fitAxonBoundingRangeCentered(
  W: number,
  H: number,
  zMin: number,
  zMax: number,
  width: number,
  height: number,
  margin: { top: number; right: number; bottom: number; left: number },
  params: AxonParams
) {
  const corners = [
    [0, 0, zMin],
    [W, 0, zMin],
    [0, H, zMin],
    [W, H, zMin],
    [0, 0, zMax],
    [W, 0, zMax],
    [0, H, zMax],
    [W, H, zMax],
  ].map(([X, Y, Z]) => axonProject(X, Y, Z, params))

  let minX = +Infinity,
    minY = +Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of corners) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom
  const worldW = Math.max(1e-6, maxX - minX)
  const worldH = Math.max(1e-6, maxY - minY)
  const scale = Math.min(innerW / worldW, innerH / worldH)

  const xc = (minX + maxX) / 2
  const yc = (minY + maxY) / 2
  const cx = margin.left + innerW / 2
  const cy = margin.top + innerH / 2

  const ox = cx - xc * scale
  const oy = cy + yc * scale

  return {
    project(X: number, Y: number, Z: number) {
      const p = axonProject(X, Y, Z, params)
      return { x: ox + p.x * scale, y: oy - p.y * scale }
    },
    scale,
  }
}
