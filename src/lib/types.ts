export interface Segment {
  km: number
  grade: number
}

export interface ClimbData {
  name: string
  segments: Segment[]
}

export interface CanvasConfig {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
}

export interface AxonParams {
  yawDeg: number
  pitchDeg: number
  rollDeg: number
  xScale: number
  verticalExaggeration: number
}

export type RoofAnchor = "front" | "center" | "back"

export interface RoofConfig {
  depthFrac: number
  depthOverrideKm: number | null
  anchor: RoofAnchor
  zOffsetKm: number
}

export interface PlatformConfig {
  /** Fixed pixel height for the shelf (screen-space). */
  heightPx: number
  fill: string
  wallFill: string
}

export interface GridConfig {
  /**
   * Grid step for distance axis in user units.
   * - metric: kilometers
   * - imperial: miles
   */
  distStep: number
  elevLines: number
}

export interface RoadStyle {
  strokeWidth: number
  dash: string
}

export interface FaceStyle {
  stroke: string
  strokeWidth: number
}

export interface SlopeColor {
  upTo: number
  color: string
}

export interface Config {
  canvas: CanvasConfig
  axon: AxonParams
  roof: RoofConfig
  platform: PlatformConfig
  grid: GridConfig
  road: RoadStyle
  face: FaceStyle
  titleFontSize: number
  labelFontSize: number
  slopeColors: SlopeColor[]
  /** Units used for labels and axis steps. */
  units: "metric" | "imperial"
}
