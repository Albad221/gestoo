import { Building2, Shield, Landmark, Scale } from 'lucide-react';

const partners = [
  {
    icon: Building2,
    name: 'Ministere du Tourisme',
    role: 'Tutelle et regulation',
  },
  {
    icon: Shield,
    name: 'Police Nationale',
    role: 'Securite et enregistrement',
  },
  {
    icon: Landmark,
    name: 'Direction Generale des Impots',
    role: 'Collecte des taxes',
  },
  {
    icon: Scale,
    name: 'Ministere de la Justice',
    role: 'Protection juridique',
  },
];

export function PartnersSection() {
  return (
    <section className="section-padding border-t border-gray-100">
      <div className="container-custom">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Partenaires institutionnels
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            Une initiative soutenue par l'Etat
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="flex flex-col items-center text-center p-6"
            >
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <partner.icon className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{partner.name}</h3>
              <p className="text-sm text-gray-500">{partner.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
