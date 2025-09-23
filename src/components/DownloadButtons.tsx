"use client"

import React from "react"
import { downloadPNG, downloadSVG } from "@/lib/utils/download"

export default function DownloadButtons({
  svg,
  baseFilename,
  style,
}: {
  svg: SVGSVGElement
  baseFilename: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={
        style ?? {
          display: "flex",
          gap: 8,
          margin: "12px auto 24px",
          justifyContent: "center",
        }
      }
    >
      <button onClick={() => downloadSVG(svg, `${baseFilename}.svg`)}>Download SVG</button>
      <button onClick={() => downloadPNG(svg, `${baseFilename}.png`)}>Download PNG</button>
    </div>
  )
}
