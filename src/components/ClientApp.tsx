"use client"

import React, { useRef } from "react"
import ProfileChart from "./ProfileChart"
import { ClimbData, Config } from "@/lib/types"
import { downloadPNG, downloadSVG } from "@/lib/utils/download"

/**
 * Client-only wrapper so we can use refs, window/document, and download functions.
 */
export default function ClientApp({ data, config }: { data: ClimbData; config: Config }) {
  const svgRef = useRef<SVGSVGElement | null>(null)

  const handleDownloadSVG = () => {
    const svg = svgRef.current
    if (!svg) return
    downloadSVG(svg, (data.name || "climb") + ".svg")
  }

  const handleDownloadPNG = () => {
    const svg = svgRef.current
    if (!svg) return
    downloadPNG(svg, (data.name || "climb") + ".png", 2)
  }

  // const [data2, setData2] = React.useState<ClimbData | null>(null)
  // React.useEffect(() => {
  //   ;(async () => {
  //     const res = await fetch("/api/strava/segment/5399200?bins_km=1")
  //     const results = await res.json()
  //     console.log("strava results:", results)
  //     setData2({ name: results.name, segments: results.profile.segments })
  //   })()
  // }, [])

  return (
    <>
      <ProfileChart data={data} config={config} svgRef={svgRef} />
      {/* {data2 != null && <ProfileChart data={data2} config={config} svgRef={svgRef} />} */}
      <div style={{ display: "flex", gap: 8, margin: "12px auto 24px", justifyContent: "center" }}>
        <button onClick={handleDownloadSVG}>Download SVG</button>
        <button onClick={handleDownloadPNG}>Download PNG</button>
      </div>
    </>
  )
}
