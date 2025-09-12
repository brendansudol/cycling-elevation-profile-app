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

  return (
    <>
      <ProfileChart data={data} config={config} svgRef={svgRef} />
      <div style={{ display: "flex", gap: 8, margin: "12px auto 24px", justifyContent: "center" }}>
        <button onClick={handleDownloadSVG}>Download SVG</button>
        <button onClick={handleDownloadPNG}>Download PNG</button>
      </div>
    </>
  )
}
