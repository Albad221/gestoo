import { MessageCircle } from 'lucide-react';
import { cn, WHATSAPP_LINK } from '@/lib/utils';

interface WhatsAppButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'floating';
  children?: React.ReactNode;
}

export function WhatsAppButton({
  className,
  variant = 'default',
  children,
}: WhatsAppButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200';

  const variants = {
    default:
      'px-6 py-3 bg-[#25D366] text-white rounded-lg hover:bg-[#22c35e] shadow-lg hover:shadow-xl',
    outline:
      'px-6 py-3 border-2 border-[#25D366] text-[#25D366] rounded-lg hover:bg-[#25D366] hover:text-white',
    floating:
      'fixed bottom-6 right-6 w-14 h-14 bg-[#25D366] text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 z-50',
  };

  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(baseStyles, variants[variant], className)}
    >
      <MessageCircle className={variant === 'floating' ? 'h-6 w-6' : 'h-5 w-5'} />
      {variant !== 'floating' && (children || 'Contacter via WhatsApp')}
    </a>
  );
}
