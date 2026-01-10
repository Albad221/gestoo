import type { WhatsAppMessage, ChatbotSession, CreateLandlordInput } from '@gestoo/types';
import { updateSession } from '../lib/session.js';
import { sendMessage, sendInteractiveButtons } from '../lib/wati.js';
import { supabase } from '../lib/supabase.js';

export async function handleOnboarding(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  switch (session.state) {
    case 'ONBOARDING_START':
      await handleOnboardingStart(phone, message, session);
      break;

    case 'ONBOARDING_NAME':
      await handleOnboardingName(phone, message, session);
      break;

    case 'ONBOARDING_CNI':
      await handleOnboardingCni(phone, message, session);
      break;

    case 'ONBOARDING_CNI_PHOTO':
      await handleOnboardingCniPhoto(phone, message, session);
      break;

    case 'ONBOARDING_CONFIRM':
      await handleOnboardingConfirm(phone, message, session);
      break;
  }
}

async function handleOnboardingStart(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  const lang = session.data?.language || 'fr';
  const isWolof = lang === 'wo';

  // Handle button replies
  if (message.type === 'interactive' && message.interactive?.button_reply) {
    const reply = message.interactive.button_reply.id;

    if (reply === 'new_user') {
      const msg = isWolof
        ? "Dalal ak jamm! 🎉\n\nNgir bindu, soxla naa ay xbaar.\n\nNaka sa tur bu bees?"
        : "Bienvenue ! 🎉\n\nPour vous inscrire, j'ai besoin de quelques informations.\n\nQuel est votre nom complet ?";
      await sendMessage(phone, msg);
      await updateSession(phone, { state: 'ONBOARDING_NAME', data: { language: lang } });
    } else if (reply === 'existing_user') {
      // Try to find existing landlord by phone
      const { data: landlord } = await supabase
        .from('landlords')
        .select('id, full_name')
        .eq('phone', phone)
        .single();

      if (landlord) {
        const msg = isWolof
          ? `Dalal ak jamm, ${landlord.full_name}! 👋\n\nSa compte gis nañu ko.`
          : `Bon retour, ${landlord.full_name} ! 👋\n\nVotre compte a été retrouvé.`;
        await sendMessage(phone, msg);
        await updateSession(phone, {
          state: 'IDLE',
          landlord_id: landlord.id,
          data: { language: lang },
        });
      } else {
        const msg = isWolof
          ? "Gisuma compte bu ëpp ci bii numero.\n\nBëgg nga sos compte bu bees?"
          : "Je ne trouve pas de compte associé à ce numéro.\n\nSouhaitez-vous créer un nouveau compte ?";
        await sendMessage(phone, msg);
        await sendInteractiveButtons(phone, 'Inscription', [
          { id: 'new_user', title: isWolof ? 'Sos compte' : 'Créer un compte' },
          { id: 'help', title: isWolof ? 'Ndimbal' : 'Contacter le support' },
        ]);
      }
    }
    return;
  }

  // Handle text messages - detect intent or re-show buttons
  if (message.type === 'text' && message.text?.body) {
    const text = message.text.body.toLowerCase().trim();

    // Check if user wants to register
    const registerWords = ['oui', 'yes', 'nouveau', 'inscrire', 'waaw', 'créer', 'new'];
    const existingWords = ['déjà', 'already', 'compte', 'inscrit', 'existing', 'bindu naa'];

    if (registerWords.some(w => text.includes(w))) {
      const msg = isWolof
        ? "Baax! Dinaa la dimbal bindu.\n\nNaka sa tur bu bees?"
        : "Parfait ! Je vais vous aider à vous inscrire.\n\nQuel est votre nom complet ?";
      await sendMessage(phone, msg);
      await updateSession(phone, { state: 'ONBOARDING_NAME', data: { language: lang } });
      return;
    }

    if (existingWords.some(w => text.includes(w))) {
      // Try to find existing landlord
      const { data: landlord } = await supabase
        .from('landlords')
        .select('id, full_name')
        .eq('phone', phone)
        .single();

      if (landlord) {
        const msg = isWolof
          ? `Dalal ak jamm, ${landlord.full_name}! 👋`
          : `Bon retour, ${landlord.full_name} ! 👋`;
        await sendMessage(phone, msg);
        await updateSession(phone, { state: 'IDLE', landlord_id: landlord.id, data: { language: lang } });
        return;
      }
    }

    // Default: re-show the buttons
    const msg = isWolof
      ? "Ndax bindu nga ci Gestoo?"
      : "Êtes-vous déjà inscrit sur Gestoo ?";
    await sendMessage(phone, msg);
    await sendInteractiveButtons(phone, 'Inscription', [
      { id: 'new_user', title: isWolof ? 'Bindu (Nouveau)' : 'Nouveau propriétaire' },
      { id: 'existing_user', title: isWolof ? 'Bindu naa (Déjà)' : 'Déjà inscrit' },
    ]);
  }
}

async function handleOnboardingName(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'text' || !message.text) {
    await sendMessage(phone, 'Veuillez entrer votre nom complet en texte.');
    return;
  }

  const fullName = message.text.body.trim();

  if (fullName.length < 3) {
    await sendMessage(phone, 'Le nom semble trop court. Veuillez entrer votre nom complet.');
    return;
  }

  await updateSession(phone, {
    state: 'ONBOARDING_CNI',
    data: { ...session.data, full_name: fullName },
  });

  await sendMessage(
    phone,
    `Merci, ${fullName} !\n\nMaintenant, veuillez entrer votre numéro de CNI (Carte Nationale d'Identité).`
  );
}

async function handleOnboardingCni(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'text' || !message.text) {
    await sendMessage(phone, 'Veuillez entrer votre numéro de CNI en texte.');
    return;
  }

  const cniNumber = message.text.body.trim().toUpperCase();

  // Basic CNI validation (Senegal CNI format)
  if (cniNumber.length < 10) {
    await sendMessage(
      phone,
      'Le numéro de CNI semble incorrect. Veuillez vérifier et réessayer.'
    );
    return;
  }

  await updateSession(phone, {
    state: 'ONBOARDING_CNI_PHOTO',
    data: { ...session.data, cni_number: cniNumber },
  });

  await sendMessage(
    phone,
    `Parfait ! 📸\n\nPour vérifier votre identité, veuillez envoyer une photo de votre CNI (recto).`
  );
}

async function handleOnboardingCniPhoto(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'image') {
    await sendMessage(
      phone,
      `Veuillez envoyer une photo de votre CNI.\n\nSi vous n'avez pas votre CNI sous la main, tapez 'plus tard' pour continuer sans.`
    );
    return;
  }

  // TODO: Download and process image, run OCR
  const cniPhotoId = message.image?.id;

  await updateSession(phone, {
    state: 'ONBOARDING_CONFIRM',
    data: { ...session.data, cni_photo_id: cniPhotoId },
  });

  const data = session.data as unknown as CreateLandlordInput & { cni_photo_id?: string };

  await sendMessage(
    phone,
    `✅ Photo reçue !\n\nRécapitulatif de votre inscription :\n\n👤 Nom : ${data.full_name}\n🆔 CNI : ${data.cni_number}\n📱 Téléphone : ${phone}\n\nConfirmez-vous ces informations ?`
  );

  await sendInteractiveButtons(phone, 'Confirmation', [
    { id: 'confirm', title: '✅ Confirmer' },
    { id: 'restart', title: '🔄 Recommencer' },
  ]);
}

async function handleOnboardingConfirm(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'interactive' || !message.interactive?.button_reply) {
    await sendMessage(phone, 'Veuillez confirmer ou recommencer votre inscription.');
    return;
  }

  const reply = message.interactive.button_reply.id;

  if (reply === 'restart') {
    await updateSession(phone, { state: 'ONBOARDING_NAME', data: {} });
    await sendMessage(phone, `D'accord, recommençons.\n\nQuel est votre nom complet ?`);
    return;
  }

  if (reply === 'confirm') {
    const data = session.data as unknown as CreateLandlordInput & { cni_photo_id?: string };

    // Create landlord in database
    const { data: landlord, error } = await supabase
      .from('landlords')
      .insert({
        full_name: data.full_name,
        phone: phone,
        cni_number: data.cni_number,
        // cni_photo_url would be set after uploading to storage
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating landlord:', error);
      await sendMessage(
        phone,
        "Une erreur s'est produite lors de l'inscription. Veuillez réessayer."
      );
      return;
    }

    await updateSession(phone, {
      state: 'IDLE',
      landlord_id: landlord.id,
      data: {},
    });

    await sendMessage(
      phone,
      `🎉 Félicitations, ${data.full_name} !\n\nVotre compte Gestoo a été créé avec succès.\n\nVous pouvez maintenant :\n• Enregistrer vos propriétés\n• Déclarer vos locataires\n• Payer la TPT\n\nTapez 'menu' pour commencer !`
    );
  }
}
