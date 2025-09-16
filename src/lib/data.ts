import { ClimbData } from "./types"

export const SAMPLE: ClimbData = {
  name: "Grand Colombier",
  startElevationM: 0,
  segments: [
    { km: 1.0, grade: 5.8 },
    { km: 1.0, grade: 7.4 },
    { km: 1.0, grade: 9.1 },
    { km: 1.0, grade: 9.3 },
    { km: 1.0, grade: 5.9 },
    { km: 1.0, grade: 11.9 },
    { km: 1.0, grade: 10.4 },
    { km: 1.0, grade: 5.0 },
    { km: 1.0, grade: 4.1 },
    { km: 1.0, grade: 8.6 },
    { km: 1.0, grade: 7.9 },
    { km: 1.0, grade: 9.3 },
    { km: 1.0, grade: 5.1 },
    { km: 1.0, grade: 3.8 },
    { km: 1.0, grade: 4.4 },
    { km: 1.0, grade: 7.3 },
    { km: 0.7, grade: 6.2 },
  ],
}

/** Parse ?data= from searchParams. Accepts JSON or base64-encoded JSON. */
export function parseDataParam(raw?: string): ClimbData | null {
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(raw)) as ClimbData
  } catch {
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8")
      return JSON.parse(decoded) as ClimbData
    } catch {
      return null
    }
  }
}
