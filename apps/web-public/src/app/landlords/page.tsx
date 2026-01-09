import { Metadata } from 'next';
import {
  Shield,
  FileText,
  Camera,
  CreditCard,
  CheckCircle,
  Clock,
  Users,
  Calculator,
  Scale,
  Award,
  ChevronDown,
  MessageCircle,
  ArrowRight,
  Building2,
  IdCard,
  FileCheck,
} from 'lucide-react';
import { SectionHeader } from '@/components/shared/section-header';
import { WhatsAppButton } from '@/components/shared/whatsapp-button';

export const metadata: Metadata = {
  title: 'Proprietaires - Teranga Safe',
  description:
    'Guide complet pour enregistrer votre hebergement sur Teranga Safe. Documents requis, processus d\'inscription et avantages.',
};

const requiredDocuments = [
  {
    icon: IdCard,
    title: 'Carte Nationale d\'Identite (CNI)',
    description:
      'Une copie claire et lisible de votre CNI en cours de validite.',
    required: true,
  },
  {
    icon: FileText,
    title: 'Numero NINEA',
    description:
      'Votre numero d\'identification nationale des entreprises et associations.',
    required: true,
  },
  {
    icon: Camera,
    title: 'Photos de l\'hebergement',
    description:
      'Minimum 5 photos: facade, chambres, espaces communs, sanitaires.',
    required: true,
  },
  {
    icon: Building2,
    title: 'Titre de propriete ou bail',
    description:
      'Justificatif de propriete ou contrat de location avec autorisation de sous-location.',
    required: true,
  },
  {
    icon: FileCheck,
    title: 'Attestation d\'assurance',
    description:
      'Assurance responsabilite civile couvrant l\'activite d\'hebergement.',
    required: false,
  },
];

const registrationSteps = [
  {
    number: '01',
    title: 'Contactez-nous via WhatsApp',
    description:
      'Envoyez un message au +221 77 123 45 67. Notre assistant vous guidera tout au long du processus.',
    duration: '2 min',
  },
  {
    number: '02',
    title: 'Envoyez vos documents',
    description:
      'Photographiez et envoyez les documents requis directement dans la conversation WhatsApp.',
    duration: '5 min',
  },
  {
    number: '03',
    title: 'Verification et validation',
    description:
      'Notre equipe verifie vos documents et la conformite de votre hebergement sous 48h ouvrees.',
    duration: '24-48h',
  },
  {
    number: '04',
    title: 'Reception de votre licence',
    description:
      'Votre licence officielle TRG-XXXX-XXXXX vous est delivree par WhatsApp et email.',
    duration: 'Immediat',
  },
];

const benefits = [
  {
    icon: Shield,
    title: 'Protection juridique complete',
    description:
      'Exercez en toute legalite avec une licence reconnue par toutes les autorites senegalaises.',
  },
  {
    icon: Calculator,
    title: 'Fiscalite simplifiee',
    description:
      'Declaration et paiement des taxes integres. Recevez des attestations fiscales automatiques.',
  },
  {
    icon: Users,
    title: 'Acces aux plateformes',
    description:
      'Seuls les hebergements certifies peuvent apparaitre sur les plateformes de reservation.',
  },
  {
    icon: Award,
    title: 'Label de qualite',
    description:
      'Le badge Teranga Safe rassure les voyageurs et augmente votre taux de reservation.',
  },
  {
    icon: Scale,
    title: 'Concurrence loyale',
    description:
      'Tous les acteurs du marche sont soumis aux memes regles et obligations.',
  },
  {
    icon: Clock,
    title: 'Gain de temps',
    description:
      'Plus besoin de demarches multiples. Un seul enregistrement pour toutes vos obligations.',
  },
];

const faqs = [
  {
    question: 'Combien coute l\'enregistrement?',
    answer:
      'L\'enregistrement initial sur Teranga Safe est gratuit. Seules les taxes de sejour (200 FCFA par nuit et par voyageur) sont a collecter aupres de vos hotes et a reverser mensuellement.',
  },
  {
    question: 'Quelle est la duree de validite de la licence?',
    answer:
      'La licence Teranga Safe est valide pour une duree de 2 ans. Le renouvellement peut etre effectue en ligne 30 jours avant l\'expiration.',
  },
  {
    question: 'Puis-je enregistrer plusieurs hebergements?',
    answer:
      'Oui, vous pouvez enregistrer autant d\'hebergements que vous possedez. Chaque bien recevra une licence unique avec son propre numero TRG.',
  },
  {
    question: 'Que se passe-t-il si je ne m\'enregistre pas?',
    answer:
      'L\'exploitation d\'un hebergement touristique sans licence est passible d\'amendes allant de 500 000 a 5 000 000 FCFA et peut entrainer la fermeture administrative de l\'etablissement.',
  },
  {
    question: 'Comment declarer mes voyageurs?',
    answer:
      'Apres l\'obtention de votre licence, vous recevrez acces a l\'application de declaration. Chaque arrivee et depart doit etre enregistre sous 24h.',
  },
  {
    question: 'Quelles sont les obligations apres l\'enregistrement?',
    answer:
      'Vous devez declarer chaque voyageur, collecter et reverser la taxe de sejour mensuellement, et maintenir les standards de securite et d\'hygiene requis.',
  },
];

export default function LandlordsPage() {
  return (
    <>
      {/* Hero */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teranga-green/10 rounded-full text-teranga-green text-sm font-medium mb-6">
                <Shield className="h-4 w-4" />
                Guide d'inscription
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Enregistrez votre hebergement
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Rejoignez les milliers de proprietaires qui ont choisi la
                conformite et la tranquillite d'esprit. Le processus prend moins
                de 10 minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <WhatsAppButton>
                  <MessageCircle className="h-5 w-5" />
                  Commencer l'inscription
                </WhatsAppButton>
                <a
                  href="#documents"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:border-teranga-green hover:text-teranga-green transition-colors"
                >
                  Voir les documents requis
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-teranga-green/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-teranga-green" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Temps d'inscription</p>
                    <p className="text-2xl font-bold text-gray-900">~10 minutes</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    'Processus 100% en ligne via WhatsApp',
                    'Verification sous 48h ouvrees',
                    'Support en francais et wolof',
                    'Accompagnement personnalise',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-teranga-green flex-shrink-0" />
                      <span className="text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Required Documents */}
      <section id="documents" className="section-padding">
        <div className="container-custom">
          <SectionHeader
            subtitle="Documents requis"
            title="Preparez votre dossier"
            description="Rassemblez ces documents avant de commencer votre inscription pour un processus rapide."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {requiredDocuments.map((doc) => (
              <div
                key={doc.title}
                className="relative bg-white p-6 rounded-xl border border-gray-100 shadow-sm"
              >
                {doc.required && (
                  <span className="absolute top-4 right-4 px-2 py-1 bg-teranga-green/10 text-teranga-green text-xs font-medium rounded-full">
                    Obligatoire
                  </span>
                )}
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
                  <doc.icon className="h-6 w-6 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {doc.title}
                </h3>
                <p className="text-sm text-gray-600">{doc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Process */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <SectionHeader
            subtitle="Processus d'inscription"
            title="Comment ca marche?"
            description="Suivez ces etapes simples pour obtenir votre licence Teranga Safe."
          />

          <div className="max-w-4xl mx-auto">
            {registrationSteps.map((step, index) => (
              <div key={step.number} className="relative flex gap-6 pb-12 last:pb-0">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-teranga-green flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {step.number}
                  </div>
                  {index < registrationSteps.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-200 mt-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {step.title}
                    </h3>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                      {step.duration}
                    </span>
                  </div>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <WhatsAppButton>
              <MessageCircle className="h-5 w-5" />
              Demarrer maintenant
            </WhatsAppButton>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-padding">
        <div className="container-custom">
          <SectionHeader
            subtitle="Avantages"
            title="Pourquoi s'enregistrer?"
            description="Decouvrez tous les avantages de l'enregistrement sur Teranga Safe."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-teranga-green/10 flex items-center justify-center mb-4">
                  <benefit.icon className="h-6 w-6 text-teranga-green" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <SectionHeader
            subtitle="FAQ"
            title="Questions frequentes"
            description="Trouvez les reponses aux questions les plus posees par les proprietaires."
          />

          <div className="max-w-3xl mx-auto">
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <details
                  key={index}
                  className="group bg-white rounded-xl border border-gray-100 shadow-sm"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                    <span className="font-semibold text-gray-900 pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown className="h-5 w-5 text-gray-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-6 pb-6 pt-0">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding gradient-teranga">
        <div className="container-custom text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Pret a commencer?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Notre equipe est disponible 7j/7 pour vous accompagner dans votre
            inscription. Contactez-nous maintenant via WhatsApp.
          </p>
          <WhatsAppButton className="bg-white text-teranga-green hover:bg-gray-100">
            <MessageCircle className="h-5 w-5" />
            Contacter via WhatsApp
          </WhatsAppButton>
        </div>
      </section>

      {/* Floating WhatsApp */}
      <WhatsAppButton variant="floating" />
    </>
  );
}
