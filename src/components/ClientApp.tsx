"use client"

import React from "react"
import ProfileChart from "./ProfileChart"
import { ClimbData, Config } from "@/lib/types"
import DownloadButtons from "./DownloadButtons"

const USE_STATIC_DATA = true

export default function ClientApp({
  data: initialData,
  config,
}: {
  data: ClimbData
  config: Config
}) {
  const [svg, svgRefCallback] = React.useState<SVGSVGElement | null>(null)
  const [data, setData] = React.useState<ClimbData>()

  React.useEffect(() => {
    ;(async () => {
      if (USE_STATIC_DATA) return setData(initialData)
      const res = await fetch("/api/strava/segment/5399200?bins_km=1")
      const results = await res.json()
      console.log("strava results:", { results })
      setData({ name: results.name, segments: results.profile.segments })
    })()
  }, [])

  if (data == null) return null

  return (
    <>
      <ProfileChart data={data} config={config} svgRef={svgRefCallback} />
      {svg != null && <DownloadButtons svg={svg} baseFilename={data.name || "climb"} />}
    </>
  )
}
