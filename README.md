# Climb Profile — Axonometric Elevation Profiles

Pure React + SVG app that renders axonometric elevation profiles for cycling climbs. It supports slope-based coloring, distance/elevation grids, and one‑click export to SVG/PNG. Includes an optional Strava Segment API route to fetch stream data and compute the profile.

## Highlights

- Pure SVG rendering: no charting libraries
- Axonometric projection with configurable camera (yaw/pitch/roll)
- Slope ribbon with color buckets and dashed centerline
- Distance/elevation axes with adaptive grid/ticks
- Fixed-height platform/shelf for a grounded 3D look
- Metric or imperial labels and steps
- One‑click export to `SVG` and `PNG` (theme colors inlined)
- Optional Strava Segment endpoint for server-side stream processing

## Quick Start

Prerequisites: Node.js 18+ (or any version supported by Next 15).

```
npm install
npm run dev
# open http://localhost:3000
```

Build and run production:

```
npm run build
npm start
```

## Data Model

The chart expects a simple profile made of sequential segments with length and average grade.

```ts
// src/lib/types.ts
export interface Segment {
  km: number
  grade: number
}

export interface ClimbData {
  name: string
  segments: Segment[]
  // Optional absolute starting elevation in meters.
  // If provided, the elevation-axis labels are offset from this value.
  // If omitted, the elevation-axis labels start at 0 (current relative behavior).
  startElevM?: number
}
```

Sample data lives in `src/lib/data.ts` and is used on the homepage by default.

## Configuration

Most visuals can be adjusted in `src/lib/config.ts`:

- Canvas: width, height, margins
- Axonometric camera: `yawDeg`, `pitchDeg`, `rollDeg`, `xScale`, `verticalExaggeration`
- Roof ribbon: depth as a fraction of distance or fixed km, anchor (`front|center|back`), `zOffsetKm`
- Platform/shelf: fixed pixel height and fills
- Grid: distance step (in user units) and target elevation line count
- Road/face styles: stroke widths, dash, edge stroke
- Typography: title and label font sizes
- Units: `metric` or `imperial` (affects labels and grid steps)
- Slope colors: thresholds and colors for ribbon tiles

All coordinates are computed in world space (km) and projected into screen space using a simple orthographic axonometric transform. Elevation exaggeration only affects world Y, not the shelf height.

## Features in Code

- `src/components/ProfileChart.tsx`: Single SVG component that builds the platform, face, grid, roof ribbon, axes, and title. It computes a bounded projection that fits the world extents and centers the composition, then offsets by half the shelf to keep the overall picture balanced.
- `src/components/ClientApp.tsx`: Client wrapper that manages the SVG ref and renders the chart and controls.
- `src/components/DownloadButtons.tsx`: Small component that renders SVG/PNG export buttons given a concrete `svg` element and base filename.
- `src/lib/utils/projection.ts`: Axonometric projector (yaw → pitch → roll) with a fit/center helper over a Z range.
- `src/lib/utils/math.ts`: Accumulation, average grade, nice step sizing, and small vector helpers.
- `src/lib/utils/color.ts`: Slope bucket lookup.
- `src/lib/utils/theme.ts`: Inlines CSS custom properties onto the `<svg>` before export so SVG/PNG keep theme colors.
- `src/lib/utils/download.ts`: Exports the current SVG as `SVG` or rasterizes to `PNG` via a canvas.

Styling lives in `src/app/globals.css`. Theme variables are defined under `:root` and also applied to exports via inlining.

## Strava Segment API (optional)

The app includes a Next.js route that fetches Strava streams for a segment and converts them to the `ClimbData` format.

Endpoint:

```
GET /api/strava/segment/:id
```

Query params:

- `bins_km` (number, default `1`): distance bin size used to compute `{ km, grade }` slices
- `lat_step` (integer, default `10`): keep every Nth `latlng` sample (reduces payload)

Authentication (choose one):

- Send `Authorization: Bearer <access_token>` header
- Or set service credentials in a local env file (do not commit secrets):

```
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_REFRESH_TOKEN=...
```

Example:

```
curl \
  -H "Authorization: Bearer $STRAVA_ACCESS_TOKEN" \
  "http://localhost:3000/api/strava/segment/229781?bins_km=0.5&lat_step=8"
```

Response (shape, abbreviated):

```json
{
  "id": 229781,
  "name": "Some Climb",
  "profile": {
    "segments": [{ "km": 0.5, "grade": 7.2 }, ...],
    "total_km": 8.7,
    "total_gain_m": 612
  },
  "streams": {
    "points": [{ "d_km": 0.0, "elev_m": 420 }, ...],
    "latlng": [[46.1, 5.7], ...],
    "sample_count": 1234
  },
  "meta": { "average_grade": 7.1, ... }
}
```

There is commented sample code in `ClientApp.tsx` showing how to fetch from this route and render the results instead of the static sample.

## Accessibility

- The profile host uses `role="img"` with a descriptive `aria-label`.
- Titles and value summaries are rendered as text inside the SVG.

## Printing & Export

- The page includes a `@page` rule for A4 landscape printing.
- Use the built‑in buttons to download `SVG` or high‑DPI `PNG` exports.

## Notes

- Built with Next.js 15 and React 19.
- The UI uses simple CSS with Tailwind v4 base imported for resets/utilities; charts themselves are plain SVG.
- No external charting libraries are used.

## Roadmap ideas

- Interactivity: tooltips, hover highlights, steepness legend
- Camera presets and keyboard nudging
- Support `?data=` on the default page for shareable URLs
- UI for fetching and selecting Strava segments

---

If you have feedback or want enhancements, feel free to open an issue or PR.
