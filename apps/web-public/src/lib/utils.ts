import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WHATSAPP_NUMBER = '+221771234567';
export const WHATSAPP_MESSAGE = encodeURIComponent(
  'Bonjour, je souhaite enregistrer mon hebergement sur Teranga Safe.'
);
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;
