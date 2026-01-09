import type { WhatsAppMessage, ChatbotSession, PropertyType } from '@gestoo/types';
import { updateSession } from '../lib/session.js';
import { sendMessage, sendInteractiveButtons, sendInteractiveList } from '../lib/whatsapp.js';
import { supabase } from '../lib/supabase.js';

export async function handlePropertyRegistration(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  switch (session.state) {
    case 'ADD_PROPERTY_NAME':
      await handlePropertyName(phone, message, session);
      break;

    case 'ADD_PROPERTY_TYPE':
      await handlePropertyType(phone, message, session);
      break;

    case 'ADD_PROPERTY_ADDRESS':
      await handlePropertyAddress(phone, message, session);
      break;

    case 'ADD_PROPERTY_LOCATION':
      await handlePropertyLocation(phone, message, session);
      break;

    case 'ADD_PROPERTY_PHOTOS':
      await handlePropertyPhotos(phone, message, session);
      break;

    case 'ADD_PROPERTY_CONFIRM':
      await handlePropertyConfirm(phone, message, session);
      break;
  }
}

async function handlePropertyName(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'text' || !message.text) {
    await sendMessage(phone, "Veuillez entrer le nom de votre établissement.");
    return;
  }

  const name = message.text.body.trim();

  if (name.length < 2) {
    await sendMessage(phone, 'Le nom semble trop court. Veuillez entrer un nom valide.');
    return;
  }

  await updateSession(phone, {
    state: 'ADD_PROPERTY_TYPE',
    data: { ...session.data, name },
  });

  await sendInteractiveList(
    phone,
    'Type de propriété',
    'Quel type de propriété souhaitez-vous enregistrer ?',
    'Choisir le type',
    [
      {
        title: 'Types de propriété',
        rows: [
          { id: 'hotel', title: '🏨 Hôtel', description: 'Établissement hôtelier classique' },
          { id: 'meuble', title: '🏠 Meublé', description: 'Appartement ou maison meublée' },
          { id: 'guesthouse', title: '🏡 Maison d\'hôtes', description: 'Chambre d\'hôtes, auberge' },
          { id: 'short_term', title: '📍 Location courte durée', description: 'Airbnb, location saisonnière' },
        ],
      },
    ]
  );
}

async function handlePropertyType(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'interactive' || !message.interactive?.list_reply) {
    await sendMessage(phone, 'Veuillez sélectionner un type de propriété dans la liste.');
    return;
  }

  const type = message.interactive.list_reply.id as PropertyType;
  const validTypes: PropertyType[] = ['hotel', 'meuble', 'guesthouse', 'short_term'];

  if (!validTypes.includes(type)) {
    await sendMessage(phone, 'Type de propriété invalide. Veuillez réessayer.');
    return;
  }

  await updateSession(phone, {
    state: 'ADD_PROPERTY_ADDRESS',
    data: { ...session.data, type },
  });

  await sendMessage(
    phone,
    "Parfait ! 📍\n\nQuelle est l'adresse complète de votre propriété ?\n\n(Ex: 12 Rue Félix Faure, Plateau, Dakar)"
  );
}

async function handlePropertyAddress(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'text' || !message.text) {
    await sendMessage(phone, "Veuillez entrer l'adresse de votre propriété.");
    return;
  }

  const address = message.text.body.trim();

  if (address.length < 10) {
    await sendMessage(phone, "L'adresse semble incomplète. Veuillez entrer une adresse plus détaillée.");
    return;
  }

  await updateSession(phone, {
    state: 'ADD_PROPERTY_LOCATION',
    data: { ...session.data, address },
  });

  await sendMessage(
    phone,
    '📍 Pour localiser précisément votre propriété, veuillez partager votre position GPS.\n\nAppuyez sur le bouton "+" puis "Position" pour partager.'
  );

  await sendInteractiveButtons(phone, 'Localisation', [
    { id: 'skip_location', title: 'Passer cette étape' },
  ]);
}

async function handlePropertyLocation(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  let gps_lat: number | undefined;
  let gps_lng: number | undefined;

  if (message.type === 'location' && message.location) {
    gps_lat = message.location.latitude;
    gps_lng = message.location.longitude;
  } else if (
    message.type === 'interactive' &&
    message.interactive?.button_reply?.id === 'skip_location'
  ) {
    // User skipped location
  } else {
    await sendMessage(
      phone,
      "Veuillez partager votre position GPS ou appuyez sur 'Passer cette étape'."
    );
    return;
  }

  await updateSession(phone, {
    state: 'ADD_PROPERTY_PHOTOS',
    data: { ...session.data, gps_lat, gps_lng },
  });

  await sendMessage(
    phone,
    '📸 Envoyez maintenant des photos de votre propriété.\n\nEnvoyez au moins 1 photo (extérieur ou intérieur), puis tapez "terminé" quand vous avez fini.'
  );
}

async function handlePropertyPhotos(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  const photos = (session.data.photos as string[]) || [];

  if (message.type === 'image' && message.image) {
    photos.push(message.image.id);

    await updateSession(phone, {
      data: { ...session.data, photos },
    });

    if (photos.length < 5) {
      await sendMessage(
        phone,
        `✅ Photo ${photos.length} reçue !\n\nVous pouvez envoyer d'autres photos ou taper 'terminé'.`
      );
    } else {
      await sendMessage(phone, '✅ 5 photos reçues. Passons à la confirmation.');
      await proceedToConfirmation(phone, session);
    }
    return;
  }

  if (message.type === 'text' && message.text?.body.toLowerCase().includes('terminé')) {
    if (photos.length === 0) {
      await sendMessage(phone, 'Veuillez envoyer au moins une photo de votre propriété.');
      return;
    }
    await proceedToConfirmation(phone, session);
    return;
  }

  await sendMessage(
    phone,
    "Veuillez envoyer une photo ou taper 'terminé' si vous avez fini."
  );
}

async function proceedToConfirmation(
  phone: string,
  session: ChatbotSession
): Promise<void> {
  const data = session.data as {
    name: string;
    type: PropertyType;
    address: string;
    gps_lat?: number;
    gps_lng?: number;
    photos: string[];
  };

  const typeLabels: Record<PropertyType, string> = {
    hotel: '🏨 Hôtel',
    meuble: '🏠 Meublé',
    guesthouse: '🏡 Maison d\'hôtes',
    short_term: '📍 Location courte durée',
  };

  await updateSession(phone, { state: 'ADD_PROPERTY_CONFIRM' });

  await sendMessage(
    phone,
    `📋 Récapitulatif de votre propriété :\n\n🏷️ Nom : ${data.name}\n📁 Type : ${typeLabels[data.type]}\n📍 Adresse : ${data.address}\n🗺️ GPS : ${data.gps_lat ? 'Oui' : 'Non'}\n📸 Photos : ${data.photos.length}\n\nConfirmez-vous ces informations ?`
  );

  await sendInteractiveButtons(phone, 'Confirmation', [
    { id: 'confirm', title: '✅ Confirmer' },
    { id: 'restart', title: '🔄 Recommencer' },
  ]);
}

async function handlePropertyConfirm(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  if (message.type !== 'interactive' || !message.interactive?.button_reply) {
    await sendMessage(phone, 'Veuillez confirmer ou recommencer.');
    return;
  }

  const reply = message.interactive.button_reply.id;

  if (reply === 'restart') {
    await updateSession(phone, { state: 'ADD_PROPERTY_NAME', data: {} });
    await sendMessage(phone, "D'accord, recommençons.\n\nQuel est le nom de votre établissement ?");
    return;
  }

  if (reply === 'confirm') {
    const data = session.data as {
      name: string;
      type: PropertyType;
      address: string;
      gps_lat?: number;
      gps_lng?: number;
      photos: string[];
    };

    // Extract city/region from address (simplified - would use geocoding API)
    const city = 'Dakar'; // TODO: Extract from address
    const region = 'Dakar'; // TODO: Extract from address

    // Create property in database
    const { data: property, error } = await supabase
      .from('properties')
      .insert({
        landlord_id: session.landlord_id,
        name: data.name,
        type: data.type,
        address: data.address,
        city,
        region,
        gps_lat: data.gps_lat,
        gps_lng: data.gps_lng,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating property:', error);
      await sendMessage(
        phone,
        "Une erreur s'est produite. Veuillez réessayer."
      );
      return;
    }

    // TODO: Upload photos to storage and create property_photos records

    await updateSession(phone, {
      state: 'IDLE',
      property_id: property.id,
      data: {},
    });

    await sendMessage(
      phone,
      `🎉 Propriété enregistrée avec succès !\n\n📋 Votre demande est en cours de vérification.\n\nUne fois validée, vous recevrez votre numéro de licence Gestoo.\n\nTapez 'menu' pour continuer.`
    );
  }
}
