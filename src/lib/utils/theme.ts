/** Copy CSS custom properties onto the <svg> so exported SVG/PNG keep colors. */
export function inlineThemeVars(svg: SVGSVGElement) {
  const root = getComputedStyle(document.documentElement)

  const FALLBACK: Record<string, string> = {
    "--face-yellow": "#f7e84a",
    "--grid": "rgba(0,0,0,.18)",
    "--road-stroke": "#2c2c2c",
    "--centerline": "#ffffff",
    "--platform": "#d1d5db",
    "--platform-wall": "#c0c6cf",
  }

  const decls = Object.keys(FALLBACK).map((v) => {
    const val = (root.getPropertyValue(v) || "").trim() || FALLBACK[v]
    return `${v}: ${val}`
  })

  const existed = (svg.getAttribute("style") || "").trim()

  svg.setAttribute("style", decls.join("; ") + (existed ? "; " + existed : ""))
}
