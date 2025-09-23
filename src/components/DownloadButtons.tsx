"use client"

import React from "react"
import { downloadPNG, downloadSVG } from "@/lib/utils/download"

export default function DownloadButtons({
  svg,
  baseFilename,
}: {
  svg: SVGSVGElement
  baseFilename: string
}) {
  return (
    <div className="flex gap-4">
      <button
        type="button"
        className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
        onClick={() => downloadSVG(svg, `${baseFilename}.svg`)}
      >
        Download SVG
      </button>

      <button
        type="button"
        className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
        onClick={() => downloadPNG(svg, `${baseFilename}.png`)}
      >
        Download PNG
      </button>
    </div>
  )
}
