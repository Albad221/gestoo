import { Metadata } from 'next';
import {
  Shield,
  Target,
  Eye,
  Users,
  Building2,
  FileCheck,
  BadgeCheck,
  Landmark,
  Scale,
  Globe,
} from 'lucide-react';
import { SectionHeader } from '@/components/shared/section-header';
import { WhatsAppButton } from '@/components/shared/whatsapp-button';

export const metadata: Metadata = {
  title: 'A propos - Teranga Safe',
  description:
    'Decouvrez la mission et la vision de Teranga Safe, la plateforme nationale du Senegal pour l\'enregistrement des hebergements touristiques.',
};

const processSteps = [
  {
    number: '01',
    title: 'Inscription',
    description:
      'Le proprietaire s\'inscrit via WhatsApp avec ses documents (CNI, NINEA, photos).',
    icon: Users,
  },
  {
    number: '02',
    title: 'Verification',
    description:
      'Notre equipe verifie les documents et la conformite du logement.',
    icon: FileCheck,
  },
  {
    number: '03',
    title: 'Certification',
    description:
      'Une licence officielle TRG-XXXX-XXXXX est delivree au proprietaire.',
    icon: BadgeCheck,
  },
  {
    number: '04',
    title: 'Declaration',
    description:
      'Les voyageurs sont enregistres et les taxes collectees automatiquement.',
    icon: Building2,
  },
];

const partners = [
  {
    name: 'Ministere du Tourisme et des Loisirs',
    role: 'Autorite de tutelle responsable de la reglementation du secteur touristique et de l\'hebergement au Senegal.',
    icon: Building2,
  },
  {
    name: 'Direction Generale de la Police Nationale',
    role: 'Partenaire securitaire assurant l\'enregistrement des voyageurs et la verification des identites.',
    icon: Shield,
  },
  {
    name: 'Direction Generale des Impots et Domaines',
    role: 'Responsable de la collecte des taxes de sejour et de la conformite fiscale des hebergements.',
    icon: Landmark,
  },
  {
    name: 'Ministere de la Justice',
    role: 'Garant du cadre juridique et de la protection des droits des proprietaires et des voyageurs.',
    icon: Scale,
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teranga-green/10 rounded-full text-teranga-green text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Plateforme Gouvernementale
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              A propos de Teranga Safe
            </h1>
            <p className="text-xl text-gray-600">
              Une initiative nationale pour moderniser et securiser le secteur de
              l'hebergement touristique au Senegal.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-14 h-14 rounded-xl bg-teranga-green/10 flex items-center justify-center mb-6">
                <Target className="h-7 w-7 text-teranga-green" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Notre Mission</h2>
              <p className="text-gray-600 leading-relaxed">
                Etablir un cadre reglementaire moderne et efficace pour le secteur
                de l'hebergement touristique au Senegal, en garantissant la
                securite des voyageurs, la conformite des proprietaires et la
                collecte equitable des taxes. Teranga Safe vise a formaliser
                l'economie de l'hebergement tout en preservant l'esprit
                d'hospitalite senegalaise - la Teranga.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-14 h-14 rounded-xl bg-teranga-yellow/20 flex items-center justify-center mb-6">
                <Eye className="h-7 w-7 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Notre Vision</h2>
              <p className="text-gray-600 leading-relaxed">
                Faire du Senegal une destination touristique de reference en
                Afrique de l'Ouest, reconnue pour la qualite et la securite de ses
                hebergements. D'ici 2030, nous visons l'enregistrement de 100% des
                hebergements touristiques et la mise en place d'un systeme de
                traitement automatise qui beneficie a tous : proprietaires,
                voyageurs et l'Etat senegalais.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <SectionHeader
            subtitle="Comment ca marche"
            title="Un processus simple et transparent"
            description="De l'inscription a la certification, decouvrez les etapes de l'enregistrement sur Teranga Safe."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {processSteps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Connector line */}
                {index < processSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-1/2 w-full h-0.5 bg-gray-200" />
                )}

                <div className="relative bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-teranga-green flex items-center justify-center text-white font-bold text-lg">
                      {step.number}
                    </div>
                    <step.icon className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Process diagram */}
          <div className="mt-16 bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-8 text-center">
              Architecture du systeme
            </h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <Globe className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Proprietaires</h4>
                <p className="text-sm text-gray-600">
                  Inscription via WhatsApp, gestion des biens, declaration des
                  sejours
                </p>
              </div>
              <div className="text-center p-6 bg-teranga-green/10 rounded-xl">
                <Shield className="h-12 w-12 text-teranga-green mx-auto mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Teranga Safe</h4>
                <p className="text-sm text-gray-600">
                  Plateforme centrale de verification, certification et suivi
                </p>
              </div>
              <div className="text-center p-6 bg-yellow-50 rounded-xl">
                <Landmark className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Institutions</h4>
                <p className="text-sm text-gray-600">
                  Police, Impots, Ministeres: acces aux donnees en temps reel
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="section-padding">
        <div className="container-custom">
          <SectionHeader
            subtitle="Partenaires gouvernementaux"
            title="Une collaboration interministerielle"
            description="Teranga Safe est le fruit d'une cooperation etroite entre plusieurs ministeres et institutions."
          />

          <div className="grid md:grid-cols-2 gap-8">
            {partners.map((partner) => (
              <div
                key={partner.name}
                className="flex gap-6 p-6 bg-white rounded-xl border border-gray-100 shadow-sm"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                  <partner.icon className="h-7 w-7 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {partner.name}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {partner.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-gray-900">
        <div className="container-custom text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Rejoignez le mouvement
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Participez a la modernisation du secteur touristique senegalais.
            Enregistrez votre hebergement des aujourd'hui.
          </p>
          <WhatsAppButton>Commencer l'inscription</WhatsAppButton>
        </div>
      </section>

      {/* Floating WhatsApp */}
      <WhatsAppButton variant="floating" />
    </>
  );
}
