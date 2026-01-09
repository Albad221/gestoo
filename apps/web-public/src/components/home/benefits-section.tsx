import {
  Shield,
  FileCheck,
  Calculator,
  Scale,
  Users,
  Globe,
  Landmark,
  Baby,
} from 'lucide-react';
import { SectionHeader } from '@/components/shared/section-header';

const landlordBenefits = [
  {
    icon: Shield,
    title: 'Protection juridique',
    description:
      'Exercez votre activite en toute legalite avec une licence officielle reconnue par les autorites senegalaises.',
  },
  {
    icon: FileCheck,
    title: 'Conformite simplifiee',
    description:
      'Un seul enregistrement pour satisfaire toutes les obligations: tourisme, police et fiscalite.',
  },
  {
    icon: Calculator,
    title: 'Gestion fiscale facilitee',
    description:
      'Declarez et payez vos taxes de sejour simplement. Recevez des attestations automatiques.',
  },
  {
    icon: Scale,
    title: 'Concurrence loyale',
    description:
      'Evoluez dans un marche reguler ou tous les acteurs respectent les memes regles.',
  },
];

const senegalBenefits = [
  {
    icon: Users,
    title: 'Securite des touristes',
    description:
      'Chaque voyageur est enregistre, garantissant leur securite et facilitant les interventions d\'urgence.',
  },
  {
    icon: Globe,
    title: 'Attractivite touristique',
    description:
      'Une image de destination sure et professionnelle pour attirer plus de visiteurs internationaux.',
  },
  {
    icon: Landmark,
    title: 'Recettes fiscales',
    description:
      'Les taxes de sejour collectees financent le developpement des infrastructures touristiques.',
  },
  {
    icon: Baby,
    title: 'Protection des mineurs',
    description:
      'Systeme de verification pour prevenir l\'exploitation et assurer la protection des enfants.',
  },
];

function BenefitCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
      <div className="w-12 h-12 rounded-lg bg-teranga-green/10 flex items-center justify-center mb-4 group-hover:bg-teranga-green group-hover:text-white transition-colors">
        <Icon className="h-6 w-6 text-teranga-green group-hover:text-white" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

export function BenefitsSection() {
  return (
    <section className="section-padding bg-gray-50">
      <div className="container-custom">
        {/* Landlord Benefits */}
        <div className="mb-20">
          <SectionHeader
            subtitle="Pour les proprietaires"
            title="Les avantages de l'enregistrement"
            description="Rejoignez les milliers de proprietaires qui ont choisi la legalite et la tranquillite d'esprit."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {landlordBenefits.map((benefit) => (
              <BenefitCard key={benefit.title} {...benefit} />
            ))}
          </div>
        </div>

        {/* Senegal Benefits */}
        <div>
          <SectionHeader
            subtitle="Pour le Senegal"
            title="Un systeme au service de la nation"
            description="Teranga Safe contribue au developpement durable du tourisme senegalais."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {senegalBenefits.map((benefit) => (
              <BenefitCard key={benefit.title} {...benefit} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
