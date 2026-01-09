import Link from 'next/link';
import { Shield, CheckCircle, ArrowRight } from 'lucide-react';
import { WhatsAppButton } from '@/components/shared/whatsapp-button';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden gradient-hero">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-teranga-green/5" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-teranga-yellow/10" />
      </div>

      <div className="container-custom relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center py-16 md:py-24">
          {/* Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teranga-green/10 rounded-full text-teranga-green text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Plateforme Officielle du Senegal
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Securisez vos{' '}
              <span className="text-teranga-green">hebergements</span> touristiques
            </h1>

            <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
              Teranga Safe est la plateforme nationale d'enregistrement des
              hebergements au Senegal. Protegez votre activite, restez conforme a
              la reglementation et contribuez au developpement du tourisme
              senegalais.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <WhatsAppButton>
                S'enregistrer via WhatsApp
              </WhatsAppButton>
              <Link
                href="/verify"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:border-teranga-green hover:text-teranga-green transition-colors"
              >
                Verifier une licence
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-teranga-green" />
                <span>Processus 100% en ligne</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-teranga-green" />
                <span>Support WhatsApp 24/7</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-teranga-green" />
                <span>Certification officielle</span>
              </div>
            </div>
          </div>

          {/* Visual */}
          <div className="relative hidden lg:block">
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
              {/* Mock license card */}
              <div className="bg-gradient-to-br from-teranga-green to-teranga-green/80 rounded-xl p-6 text-white mb-6">
                <div className="flex items-center justify-between mb-4">
                  <Shield className="h-8 w-8" />
                  <span className="text-sm font-medium opacity-80">Licence Officielle</span>
                </div>
                <div className="mb-4">
                  <p className="text-sm opacity-80">Numero de licence</p>
                  <p className="text-2xl font-bold font-mono">TRG-2024-00001</p>
                </div>
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="opacity-80">Proprietaire</p>
                    <p className="font-medium">Amadou Diallo</p>
                  </div>
                  <div className="text-right">
                    <p className="opacity-80">Valide jusqu'au</p>
                    <p className="font-medium">31/12/2025</p>
                  </div>
                </div>
              </div>

              {/* Status indicators */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Statut fiscal</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Conforme
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Enregistrement police</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Actif
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Assurance</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Valide
                  </span>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-teranga-yellow rounded-full opacity-50" />
            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-teranga-red rounded-full opacity-30" />
          </div>
        </div>
      </div>
    </section>
  );
}
