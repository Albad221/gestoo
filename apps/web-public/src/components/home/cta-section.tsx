import Link from 'next/link';
import { ArrowRight, MessageCircle, Shield } from 'lucide-react';
import { WhatsAppButton } from '@/components/shared/whatsapp-button';

export function CTASection() {
  return (
    <section className="section-padding">
      <div className="container-custom">
        <div className="relative overflow-hidden rounded-3xl bg-gray-900 p-8 md:p-12 lg:p-16">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-teranga-green/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-teranga-yellow/10 blur-3xl" />
          </div>

          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teranga-green/20 rounded-full text-teranga-green text-sm font-medium mb-6">
                <Shield className="h-4 w-4" />
                Inscription rapide et gratuite
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Pret a regulariser votre hebergement?
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                L'enregistrement prend moins de 10 minutes via WhatsApp. Notre
                equipe vous accompagne a chaque etape du processus.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <WhatsAppButton>
                  <MessageCircle className="h-5 w-5" />
                  Commencer l'inscription
                </WhatsAppButton>
                <Link
                  href="/landlords"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white border border-white/30 rounded-lg font-medium hover:bg-white/10 transition-colors"
                >
                  En savoir plus
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="hidden lg:flex justify-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-sm">
                <h3 className="text-xl font-semibold text-white mb-6">
                  Ce dont vous avez besoin:
                </h3>
                <ul className="space-y-4">
                  {[
                    'Carte Nationale d\'Identite (CNI)',
                    'Numero NINEA',
                    'Photos de votre hebergement',
                    'Numero WhatsApp actif',
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-3 text-gray-200">
                      <div className="w-6 h-6 rounded-full bg-teranga-green flex items-center justify-center text-white text-sm font-medium">
                        {index + 1}
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
