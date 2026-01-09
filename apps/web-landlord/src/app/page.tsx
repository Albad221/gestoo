import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gestoo-green/10 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gestoo-green">
              <span className="text-xl font-bold text-white">T</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Gestoo</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Connexion
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-gestoo-green px-4 py-2 text-sm font-medium text-white hover:bg-gestoo-green/90"
            >
              Inscription
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          Gérez vos hébergements en toute{' '}
          <span className="text-gestoo-green">simplicité</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Gestoo vous permet de déclarer vos locataires, collecter la Taxe
          de Promotion Touristique et rester en conformité avec la
          réglementation sénégalaise.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="rounded-lg bg-gestoo-green px-6 py-3 text-lg font-medium text-white shadow-lg hover:bg-gestoo-green/90"
          >
            Commencer gratuitement
          </Link>
          <Link
            href="#features"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-lg font-medium text-gray-700 hover:bg-gray-50"
          >
            En savoir plus
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Pourquoi choisir Gestoo ?
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-xl border p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gestoo-green/10">
                <svg
                  className="h-6 w-6 text-gestoo-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Déclaration simplifiée
              </h3>
              <p className="mt-2 text-gray-600">
                Enregistrez vos locataires en quelques clics via notre portail
                web ou WhatsApp. Fini les fiches papier !
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl border p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gestoo-yellow/30">
                <svg
                  className="h-6 w-6 text-gestoo-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Paiement TPT facile
              </h3>
              <p className="mt-2 text-gray-600">
                Payez la Taxe de Promotion Touristique via Wave ou Orange Money
                directement depuis l'application.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl border p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gestoo-red/10">
                <svg
                  className="h-6 w-6 text-gestoo-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Badge de conformité
              </h3>
              <p className="mt-2 text-gray-600">
                Obtenez un badge vérifié pour rassurer vos clients et vous
                démarquer de la concurrence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gestoo-green py-16">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white">
            Prêt à digitaliser votre hébergement ?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Rejoignez les propriétaires qui font confiance à Gestoo
          </p>
          <Link
            href="/auth/register"
            className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-lg font-medium text-gestoo-green hover:bg-gray-100"
          >
            Créer mon compte
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
          <p>&copy; 2026 Gestoo. Tous droits réservés.</p>
          <p className="mt-2">
            Une initiative du Ministère du Tourisme du Sénégal
          </p>
        </div>
      </footer>
    </main>
  );
}
