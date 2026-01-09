'use client';

import { useState } from 'react';
import { Metadata } from 'next';
import {
  Shield,
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
  Send,
  CheckCircle,
  Building2,
  Users,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { SectionHeader } from '@/components/shared/section-header';
import { WhatsAppButton } from '@/components/shared/whatsapp-button';
import { cn } from '@/lib/utils';

const contactMethods = [
  {
    icon: Phone,
    title: 'Telephone',
    value: '+221 33 123 45 67',
    description: 'Lundi - Vendredi, 8h - 18h',
    href: 'tel:+221331234567',
  },
  {
    icon: Mail,
    title: 'Email',
    value: 'contact@terangasafe.sn',
    description: 'Reponse sous 24h ouvrees',
    href: 'mailto:contact@terangasafe.sn',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    value: '+221 77 123 45 67',
    description: 'Support 7j/7, 8h - 22h',
    href: 'https://wa.me/221771234567',
  },
  {
    icon: MapPin,
    title: 'Adresse',
    value: 'Ministere du Tourisme',
    description: 'Place de l\'Independance, Dakar',
    href: 'https://maps.google.com',
  },
];

const ministryContacts = [
  {
    name: 'Ministere du Tourisme et des Loisirs',
    phone: '+221 33 823 10 26',
    email: 'info@tourisme.gouv.sn',
    address: 'Place de l\'Independance, Dakar',
  },
  {
    name: 'Direction Generale des Impots',
    phone: '+221 33 889 20 02',
    email: 'contact@dgid.sn',
    address: 'Rue Thiong x Carde, Dakar',
  },
  {
    name: 'Direction de la Police Nationale',
    phone: '17',
    email: 'contact@police.sn',
    address: 'Avenue Roume, Dakar',
  },
];

const subjects = [
  { value: 'registration', label: 'Inscription / Enregistrement' },
  { value: 'license', label: 'Question sur ma licence' },
  { value: 'tax', label: 'Taxes et paiements' },
  { value: 'technical', label: 'Probleme technique' },
  { value: 'complaint', label: 'Reclamation' },
  { value: 'partnership', label: 'Partenariat' },
  { value: 'other', label: 'Autre' },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    licenseNumber: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.subject) {
      newErrors.subject = 'Veuillez selectionner un sujet';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Le message est requis';
    } else if (formData.message.trim().length < 20) {
      newErrors.message = 'Le message doit contenir au moins 20 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  if (isSubmitted) {
    return (
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-xl mx-auto text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Message envoye!
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Merci pour votre message. Notre equipe vous repondra dans les 24
              heures ouvrees.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  setIsSubmitted(false);
                  setFormData({
                    name: '',
                    email: '',
                    phone: '',
                    subject: '',
                    licenseNumber: '',
                    message: '',
                  });
                }}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:border-teranga-green hover:text-teranga-green transition-colors"
              >
                Envoyer un autre message
              </button>
              <a
                href="/"
                className="px-6 py-3 bg-teranga-green text-white rounded-lg font-medium hover:bg-teranga-green/90 transition-colors"
              >
                Retour a l'accueil
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Hero */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teranga-green/10 rounded-full text-teranga-green text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Support Teranga Safe
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Contactez-nous
            </h1>
            <p className="text-xl text-gray-600">
              Notre equipe est a votre disposition pour repondre a toutes vos
              questions concernant l'enregistrement de votre hebergement.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactMethods.map((method) => (
              <a
                key={method.title}
                href={method.href}
                target={method.title === 'WhatsApp' ? '_blank' : undefined}
                rel={method.title === 'WhatsApp' ? 'noopener noreferrer' : undefined}
                className="group bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-teranga-green transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-teranga-green/10 flex items-center justify-center mb-4 group-hover:bg-teranga-green transition-colors">
                  <method.icon className="h-6 w-6 text-teranga-green group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{method.title}</h3>
                <p className="text-teranga-green font-medium mb-1">{method.value}</p>
                <p className="text-sm text-gray-500">{method.description}</p>
              </a>
            ))}
          </div>

          {/* Contact Form & Info */}
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Form */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Envoyez-nous un message
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Nom complet *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={cn(
                          'w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teranga-green focus:border-transparent transition-all',
                          errors.name ? 'border-red-300' : 'border-gray-300'
                        )}
                        placeholder="Votre nom"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={cn(
                          'w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teranga-green focus:border-transparent transition-all',
                          errors.email ? 'border-red-300' : 'border-gray-300'
                        )}
                        placeholder="votre@email.com"
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Telephone
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teranga-green focus:border-transparent transition-all"
                        placeholder="+221 77 123 45 67"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="licenseNumber"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Numero de licence (si applicable)
                      </label>
                      <input
                        type="text"
                        id="licenseNumber"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teranga-green focus:border-transparent transition-all"
                        placeholder="TRG-2024-00001"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="subject"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Sujet *
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className={cn(
                        'w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teranga-green focus:border-transparent transition-all',
                        errors.subject ? 'border-red-300' : 'border-gray-300'
                      )}
                    >
                      <option value="">Selectionnez un sujet</option>
                      {subjects.map((subject) => (
                        <option key={subject.value} value={subject.value}>
                          {subject.label}
                        </option>
                      ))}
                    </select>
                    {errors.subject && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.subject}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      className={cn(
                        'w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teranga-green focus:border-transparent transition-all resize-none',
                        errors.message ? 'border-red-300' : 'border-gray-300'
                      )}
                      placeholder="Decrivez votre demande en detail..."
                    />
                    {errors.message && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-teranga-green text-white font-medium rounded-lg hover:bg-teranga-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Envoyer le message
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-6">
              {/* WhatsApp CTA */}
              <div className="bg-[#25D366]/10 rounded-2xl p-6 border border-[#25D366]/20">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Reponse plus rapide?
                    </h3>
                    <p className="text-sm text-gray-600">
                      Contactez-nous sur WhatsApp
                    </p>
                  </div>
                </div>
                <WhatsAppButton className="w-full">
                  Ouvrir WhatsApp
                </WhatsAppButton>
              </div>

              {/* Ministry Contacts */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-teranga-green" />
                  Contacts ministeriels
                </h3>
                <div className="space-y-4">
                  {ministryContacts.map((contact) => (
                    <div
                      key={contact.name}
                      className="p-4 bg-gray-50 rounded-lg"
                    >
                      <h4 className="font-medium text-gray-900 text-sm mb-2">
                        {contact.name}
                      </h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          {contact.phone}
                        </p>
                        <p className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          {contact.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hours */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-teranga-green" />
                  Horaires d'ouverture
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lundi - Vendredi</span>
                    <span className="font-medium text-gray-900">8h00 - 18h00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Samedi</span>
                    <span className="font-medium text-gray-900">9h00 - 13h00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dimanche</span>
                    <span className="font-medium text-gray-500">Ferme</span>
                  </div>
                  <p className="pt-2 text-xs text-gray-500">
                    Support WhatsApp disponible 7j/7 de 8h a 22h
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map placeholder */}
      <section className="h-80 bg-gray-200 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Carte interactive</p>
            <p className="text-sm text-gray-400">
              Ministere du Tourisme, Place de l'Independance, Dakar
            </p>
          </div>
        </div>
      </section>

      {/* Floating WhatsApp */}
      <WhatsAppButton variant="floating" />
    </>
  );
}
