import { inlineThemeVars } from "./theme"

export function downloadSVG(svg: SVGSVGElement, filename: string) {
  inlineThemeVars(svg)
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function downloadPNG(svg: SVGSVGElement, filename: string, scale = 2) {
  inlineThemeVars(svg)
  const s = new XMLSerializer().serializeToString(svg)
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement("canvas")
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    const ctx = canvas.getContext("2d", { alpha: true })!
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob!)
        a.download = filename.endsWith(".png") ? filename : `${filename}.png`
        a.click()
        URL.revokeObjectURL(a.href)
      },
      "image/png",
      0.95
    )
  }
  img.src = url
}
