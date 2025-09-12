import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Climb Profile — Axonometric",
  description: "Axonometric elevation profile. Download SVG/PNG.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
