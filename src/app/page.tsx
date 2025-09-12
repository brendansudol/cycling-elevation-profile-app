import ClientApp from "@/components/ClientApp"
import { SAMPLE } from "@/lib/data"
import { CONFIG } from "@/lib/config"

export default function Page() {
  return (
    <>
      <header className="shell">
        <h1 className="text-2xl">Climb Profile</h1>
        <p className="subtitle">Axonometric elevation profile.</p>
      </header>

      <main className="shell">
        <section className="stage" aria-label="Chart stage">
          <div id="profile-host" role="img" aria-label="Rendered elevation profile">
            <ClientApp data={SAMPLE} config={CONFIG} />
          </div>
        </section>
      </main>

      <footer className="shell footnote">Built for cyclists. No external libraries.</footer>
    </>
  )
}
