import { Building2, Users, Banknote, MapPin } from 'lucide-react';

const stats = [
  {
    icon: Building2,
    value: '12,450+',
    label: 'Hebergements enregistres',
    description: 'A travers tout le Senegal',
  },
  {
    icon: Users,
    value: '485,000+',
    label: 'Voyageurs enregistres',
    description: 'En securite au Senegal',
  },
  {
    icon: Banknote,
    value: '2.5 Mrd',
    label: 'FCFA collectes',
    description: 'En taxes de sejour',
  },
  {
    icon: MapPin,
    value: '14',
    label: 'Regions couvertes',
    description: 'Sur tout le territoire',
  },
];

export function StatsSection() {
  return (
    <section className="section-padding gradient-teranga text-white">
      <div className="container-custom">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Teranga Safe en chiffres
          </h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Decouvrez l'impact de la plateforme nationale sur le secteur de
            l'hebergement au Senegal.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-6 rounded-xl bg-white/10 backdrop-blur-sm"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 mb-4">
                <stat.icon className="h-7 w-7" />
              </div>
              <div className="text-4xl font-bold mb-2">{stat.value}</div>
              <div className="text-lg font-medium mb-1">{stat.label}</div>
              <div className="text-sm text-white/70">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
