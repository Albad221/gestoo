import { HeroSection } from '@/components/home/hero-section';
import { BenefitsSection } from '@/components/home/benefits-section';
import { StatsSection } from '@/components/home/stats-section';
import { CTASection } from '@/components/home/cta-section';
import { PartnersSection } from '@/components/home/partners-section';
import { WhatsAppButton } from '@/components/shared/whatsapp-button';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BenefitsSection />
      <StatsSection />
      <CTASection />
      <PartnersSection />

      {/* Floating WhatsApp button */}
      <WhatsAppButton variant="floating" />
    </>
  );
}
