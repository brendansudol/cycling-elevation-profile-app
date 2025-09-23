import ClientApp from "@/components/ClientApp"
import { SAMPLE } from "@/lib/data"
import { CONFIG } from "@/lib/config"

export default function Page() {
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4">header</header>

      <main>
        <div className="border border-gray-200 rounded-lg p-4">
          <ClientApp data={SAMPLE} config={CONFIG} />
        </div>
      </main>

      <footer className="mt-4">footer</footer>
    </div>
  )
}
