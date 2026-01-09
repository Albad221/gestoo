import Link from 'next/link';
import { Shield, MapPin, Phone, Mail } from 'lucide-react';

const footerLinks = {
  navigation: [
    { name: 'Accueil', href: '/' },
    { name: 'A propos', href: '/about' },
    { name: 'Proprietaires', href: '/landlords' },
    { name: 'Verifier une licence', href: '/verify' },
    { name: 'Contact', href: '/contact' },
  ],
  legal: [
    { name: 'Mentions legales', href: '/legal' },
    { name: 'Politique de confidentialite', href: '/privacy' },
    { name: 'Conditions generales', href: '/terms' },
  ],
  partners: [
    { name: 'Ministere du Tourisme', href: '#' },
    { name: 'Direction Generale des Impots', href: '#' },
    { name: 'Police Nationale', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main footer */}
      <div className="container-custom py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teranga-green">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white">Teranga Safe</span>
                <span className="text-xs text-gray-400">Republique du Senegal</span>
              </div>
            </Link>
            <p className="text-sm text-gray-400 mb-6">
              Plateforme nationale pour l'enregistrement et la verification des
              hebergements touristiques au Senegal.
            </p>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teranga-green" />
                <span>Dakar, Senegal</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-teranga-green" />
                <span>+221 33 123 45 67</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-teranga-green" />
                <span>contact@terangasafe.sn</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Navigation
            </h3>
            <ul className="space-y-3">
              {footerLinks.navigation.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-teranga-green transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Informations legales
            </h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-teranga-green transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Partners */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Partenaires institutionnels
            </h3>
            <ul className="space-y-3">
              {footerLinks.partners.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-teranga-green transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="container-custom py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              {new Date().getFullYear()} Teranga Safe. Tous droits reserves.
              Republique du Senegal.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 bg-teranga-green rounded-sm" />
              <div className="w-8 h-5 bg-teranga-yellow rounded-sm" />
              <div className="w-8 h-5 bg-teranga-red rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
