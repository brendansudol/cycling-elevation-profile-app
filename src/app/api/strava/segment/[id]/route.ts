import { NextRequest, NextResponse } from "next/server"

/**
 * Query params:
 *  - bins_km: number (default 1.0)   → size of distance bins used to compute {km, grade}
 *  - lat_step: integer (default 10)  → keep every Nth latlng sample (reduces payload)
 *
 * Auth:
 *  - Prefer request header: Authorization: Bearer <STRAVA_ACCESS_TOKEN>
 *  - Or configure .env.local with STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN
 *
 * Example:
 *   GET /api/strava/segment/229781?bins_km=0.5&lat_step=8
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid or missing segment id" }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const binsKm = clampNumber(parseFloat(searchParams.get("bins_km") || "1"), 0.05, 5) ?? 1
  const latStep = clampInt(parseInt(searchParams.get("lat_step") || "10", 10), 1, 100) ?? 10

  try {
    const tokenFromHeader = extractBearer(req.headers.get("authorization"))
    const accessToken = tokenFromHeader || (await getServiceAccessToken())

    // 1) Segment metadata
    const segRes = await stravaFetch(`/segments/${id}`, accessToken)

    if (!segRes.ok) {
      const t = await safeJson(segRes)
      return NextResponse.json(
        { error: "Failed to fetch segment", details: t },
        { status: segRes.status }
      )
    }

    const segment = await segRes.json()

    // 2) Segment streams: distance (m), altitude (m), latlng ([lat,lon])
    const streamsRes = await stravaFetch(
      `/segments/${id}/streams?keys=distance,altitude,latlng&key_by_type=true`,
      accessToken
    )

    if (!streamsRes.ok) {
      const t = await safeJson(streamsRes)
      return NextResponse.json(
        { error: "Failed to fetch segment streams", details: t },
        { status: streamsRes.status }
      )
    }

    // Strava returns either an object keyed by type (with key_by_type=true) or an array of streams
    const streamsRaw = await streamsRes.json()
    const { distance, altitude, latlng } = normalizeStreams(streamsRaw)

    if (!distance?.data?.length || !altitude?.data?.length) {
      return NextResponse.json(
        { error: "Missing distance/altitude streams for segment" },
        { status: 502 }
      )
    }

    // Build raw points [{ d_km, elev_m }]
    const points = toPoints(distance.data as number[], altitude.data as number[])

    // Compute binned segments (km, grade) from streams
    const segments = binByDistance(points, binsKm)

    // Totals
    const total_km = ((distance.data as any).at(-1) ?? 0) / 1000 // eslint-disable-line @typescript-eslint/no-explicit-any
    const total_gain_m = totalGain(points)

    // Optional decimated latlng
    const latlngDecimated = Array.isArray(latlng?.data)
      ? (latlng!.data as [number, number][]).filter((_, i) => i % latStep === 0)
      : undefined

    // Useful meta fields from the segment object
    const meta = pick(segment, [
      "id",
      "name",
      "distance",
      "average_grade",
      "maximum_grade",
      "elevation_high",
      "elevation_low",
      "climb_category",
      "city",
      "state",
      "country",
      "starred",
      "athlete_pr_effort",
    ])

    return NextResponse.json({
      id: segment.id,
      name: segment.name,
      profile: { segments, total_km, total_gain_m },
      streams: {
        points, // [{ d_km, elev_m }]
        latlng: latlngDecimated, // [[lat, lon], ...] or undefined
        sample_count: points.length,
      },
      meta,
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error", message: (err as any)?.message || String(err) }, // eslint-disable-line @typescript-eslint/no-explicit-any
      { status: 500 }
    )
  }
}

/* ----------------------------- Helpers ---------------------------------- */

function clampNumber(v: number, min: number, max: number) {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : undefined
}

function clampInt(v: number, min: number, max: number) {
  return Number.isInteger(v) ? Math.max(min, Math.min(max, v)) : undefined
}

function extractBearer(authHeader: string | null) {
  if (!authHeader) return null
  const m = authHeader.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

async function getServiceAccessToken(): Promise<string> {
  const cid = process.env.STRAVA_CLIENT_ID
  const cs = process.env.STRAVA_CLIENT_SECRET
  const refresh = process.env.STRAVA_REFRESH_TOKEN
  if (!cid || !cs || !refresh) {
    throw new Error("Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN")
  }
  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: cid,
      client_secret: cs,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  })
  if (!resp.ok) {
    const t = await safeJson(resp)
    throw new Error("Failed to refresh Strava token: " + JSON.stringify(t))
  }
  const j = await resp.json()
  return j.access_token as string
}

function stravaFetch(path: string, accessToken: string) {
  const url = `https://www.strava.com/api/v3${path}`
  return fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
}

async function safeJson(r: Response) {
  try {
    return await r.json()
  } catch {
    return { status: r.status, statusText: r.statusText }
  }
}

type Stream = { data: number[] } | { data: [number, number][] }
type StreamObj = { distance?: Stream; altitude?: Stream; latlng?: Stream }

/** Accept both key_by_type=true (object) and default array-of-streams shapes */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeStreams(raw: any): StreamObj {
  if (raw && !Array.isArray(raw)) {
    // key_by_type=true shape: { distance: {data:[]}, altitude:{}, latlng:{} }
    return {
      distance: raw.distance,
      altitude: raw.altitude,
      latlng: raw.latlng,
    }
  }

  // Fallback: array shape
  const out: StreamObj = {}
  if (Array.isArray(raw)) {
    for (const s of raw) {
      if (!s || !s.type) continue
      if (s.type === "distance") out.distance = { data: s.data }
      if (s.type === "altitude") out.altitude = { data: s.data }
      if (s.type === "latlng") out.latlng = { data: s.data }
    }
  }

  return out
}

/** Convert parallel distance (m) + altitude (m) arrays to points [{ d_km, elev_m }] */
function toPoints(distanceM: number[], altitudeM: number[]) {
  const n = Math.min(distanceM.length, altitudeM.length)
  const pts: { d_km: number; elev_m: number }[] = []

  for (let i = 0; i < n; i++) {
    const d = distanceM[i]
    const e = altitudeM[i]
    if (!Number.isFinite(d) || !Number.isFinite(e)) continue
    pts.push({ d_km: d / 1000, elev_m: e })
  }

  // Ensure first point starts exactly at 0 if the stream starts near zero but not quite
  if (pts.length && pts[0].d_km > 0.005) {
    pts.unshift({ d_km: 0, elev_m: pts[0].elev_m })
  }

  return pts
}

/** Compute total positive elevation gain in meters from raw points */
function totalGain(points: { d_km: number; elev_m: number }[]) {
  let gain = 0
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].elev_m - points[i - 1].elev_m
    if (diff > 0) gain += diff
  }
  return Math.round(gain)
}

/** Bin raw points into { km, grade } slices of ~binKm each (last bin can be shorter). */
function binByDistance(points: { d_km: number; elev_m: number }[], binKm: number) {
  if (!points.length) return []
  const result: { km: number; grade: number }[] = []

  let prevD = points[0].d_km
  let prevE = points[0].elev_m
  let nextEdge = prevD + binKm

  let accDist = 0
  let accRise = 0

  const getElevAt = (targetKm: number) => {
    // Find segment [i-1, i] bracketing targetKm and interpolate
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i]
      if (targetKm >= a.d_km && targetKm <= b.d_km && b.d_km > a.d_km) {
        const t = (targetKm - a.d_km) / (b.d_km - a.d_km)
        return a.elev_m + t * (b.elev_m - a.elev_m)
      }
    }
    return points[points.length - 1].elev_m
  }

  const pushBin = () => {
    if (accDist <= 0) return
    const km = accDist
    const grade = (accRise / (km * 1000)) * 100 // percent
    result.push({ km: +km.toFixed(3), grade: +grade.toFixed(2) })
    accDist = 0
    accRise = 0
  }

  for (let i = 1; i < points.length; i++) {
    const d = points[i].d_km
    const e = points[i].elev_m

    // While we cross bin edges, split at the exact edge
    while (d >= nextEdge) {
      const eAt = getElevAt(nextEdge)
      const segKm = nextEdge - prevD
      const segRise = eAt - prevE
      accDist += segKm
      accRise += segRise
      pushBin()
      prevD = nextEdge
      prevE = eAt
      nextEdge += binKm
    }

    // Remaining piece inside current bin
    const segKm = d - prevD
    const segRise = e - prevE
    if (segKm > 0) {
      accDist += segKm
      accRise += segRise
      prevD = d
      prevE = e
    }
  }
  // Final partial bin
  pushBin()

  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>
  for (const k of keys) if (k in obj) out[k] = obj[k]
  return out
}
