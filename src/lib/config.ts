import { Config } from "./types"

export const CONFIG: Config = {
  canvas: {
    width: 1180,
    height: 720,
    margin: { top: 90, right: 170, bottom: 90, left: 60 },
  },

  // Camera
  axon: {
    yawDeg: 30,
    pitchDeg: 30,
    rollDeg: 0,
    xScale: 1.0,
    verticalExaggeration: 9.0,
  },

  // Ribbon depth (10% of distance by default; override with fixed km if needed)
  roof: {
    depthFrac: 0.1,
    depthOverrideKm: null,
    anchor: "back", // default: shifted behind ridge
    zOffsetKm: 0,
  },

  // Platform/shelf — fixed pixel height (screen-space)
  platform: {
    heightPx: 30,
    fill: "var(--platform)",
    wallFill: "var(--platform-wall)",
  },

  grid: { distStepKm: 1, elevLines: 8 },
  road: { strokeWidth: 2.4, dash: "10 10" },
  face: { stroke: "#9aa1aa", strokeWidth: 1.25 },
  titleFontSize: 26,
  labelFontSize: 13,

  slopeColors: [
    { upTo: 4.0, color: "#39A7FF" },
    { upTo: 6.0, color: "#1261A0" },
    { upTo: 8.0, color: "#121212" },
    { upTo: 10.0, color: "#D0282F" },
    { upTo: Infinity, color: "#7E0000" },
  ],
}
