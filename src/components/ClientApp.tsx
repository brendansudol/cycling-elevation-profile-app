"use client"

import React from "react"
import ProfileChart from "./ProfileChart"
import { ClimbData, Config } from "@/lib/types"
import DownloadButtons from "./DownloadButtons"
import { Leva, useControls, folder } from "leva"

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

  const { yawDeg, pitchDeg, verticalExaggeration, platformHeightPx, units } = useControls({
    Camera: folder({
      yawDeg: { value: config.axon.yawDeg, min: 0, max: 90, step: 1 },
      pitchDeg: { value: config.axon.pitchDeg, min: 0, max: 90, step: 1 },
      verticalExaggeration: {
        value: config.axon.verticalExaggeration,
        min: 1,
        max: 20,
        step: 0.25,
      },
    }),
    Platform: folder({
      platformHeightPx: { value: config.platform.heightPx, min: 0, max: 160, step: 1 },
    }),
    Units: folder({
      units: { value: config.units, options: { metric: "metric", imperial: "imperial" } },
    }),
  })

  const liveConfig: Config = React.useMemo(
    () => ({
      ...config,
      units: units as Config["units"],
      axon: {
        ...config.axon,
        yawDeg,
        pitchDeg,
        verticalExaggeration,
      },
      platform: {
        ...config.platform,
        heightPx: platformHeightPx,
      },
    }),
    [config, units, yawDeg, pitchDeg, verticalExaggeration, platformHeightPx]
  )

  if (data == null) return null

  return (
    <>
      <Leva collapsed={true} titleBar={{ title: "Controls" }} />
      <ProfileChart data={data} config={liveConfig} svgRef={svgRefCallback} />
      {svg != null && <DownloadButtons svg={svg} baseFilename={data.name || "climb"} />}
    </>
  )
}
