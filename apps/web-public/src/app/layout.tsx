import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Teranga Safe - Plateforme Nationale de Location Securisee',
  description:
    "Teranga Safe est la plateforme officielle du Senegal pour l'enregistrement et la verification des hebergements touristiques. Securite, conformite et transparence pour les proprietaires et les voyageurs.",
  keywords: [
    'Teranga Safe',
    'Senegal',
    'location',
    'hebergement',
    'tourisme',
    'enregistrement',
    'verification',
    'securite',
  ],
  openGraph: {
    title: 'Teranga Safe - Plateforme Nationale de Location Securisee',
    description:
      "Plateforme officielle du Senegal pour l'enregistrement des hebergements touristiques",
    type: 'website',
    locale: 'fr_SN',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
