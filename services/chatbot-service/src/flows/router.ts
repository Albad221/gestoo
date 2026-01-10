import type { WhatsAppMessage, ChatbotState } from '@gestoo/types';
import { getSession, updateSession } from '../lib/session.js';
import { sendMessage, sendInteractiveButtons, sendInteractiveList } from '../lib/wati.js';
import { detectIntent, detectLanguage, chat, WOLOF_RESPONSES, type ChatMessage } from '../lib/gemini.js';

// Flow handlers
import { handleOnboarding } from './onboarding.js';
import { handlePropertyRegistration } from './property.js';
import { handleGuestCheckin } from './guest-checkin.js';
import { handlePayment } from './payment.js';

const MENU_KEYWORDS = ['menu', 'aide', 'help', 'accueil', 'home', 'ndimbal'];
const GREETING_KEYWORDS_FR = ['bonjour', 'salut', 'hello', 'hi', 'bonsoir'];
const GREETING_KEYWORDS_WO = ['nanga def', 'salam', 'na nga def', 'salaam'];

export async function processMessage(message: WhatsAppMessage): Promise<void> {
  const phone = message.from;
  console.log(`[ROUTER] Processing message from ${phone}, type: ${message.type}`);

  const session = await getSession(phone);
  console.log(`[ROUTER] Session state: ${session.state}, landlord_id: ${session.landlord_id || 'none'}`);


  // Handle text messages
  if (message.type === 'text' && message.text) {
    const text = message.text.body.toLowerCase().trim();

    // Check for menu request
    if (MENU_KEYWORDS.includes(text)) {
      await showMainMenu(phone, session.landlord_id);
      return;
    }

    // Check for greetings (French or Wolof)
    const isFrenchGreeting = GREETING_KEYWORDS_FR.includes(text);
    const isWolofGreeting = GREETING_KEYWORDS_WO.some(g => text.includes(g));
    const isGreeting = isFrenchGreeting || isWolofGreeting;

    if (isGreeting && session.state === 'IDLE') {
      console.log(`[ROUTER] Greeting detected from ${phone} (${isWolofGreeting ? 'Wolof' : 'French'})`);

      if (session.landlord_id) {
        console.log(`[ROUTER] Returning user, showing main menu`);
        const greeting = isWolofGreeting
          ? WOLOF_RESPONSES.welcome_back
          : `Bienvenue ! 👋\nQue souhaitez-vous faire aujourd'hui ?`;
        await sendMessage(phone, greeting);
        await showMainMenu(phone, session.landlord_id, isWolofGreeting);
      } else {
        console.log(`[ROUTER] New user, showing onboarding`);
        const greeting = isWolofGreeting
          ? `${WOLOF_RESPONSES.greeting}\n\nNdax bindu nga ci Gestoo?`
          : `Bienvenue sur Gestoo ! 🇸🇳\n\nJe suis votre assistant pour la gestion de vos hébergements.\n\nÊtes-vous déjà inscrit sur notre plateforme ?`;

        await sendMessage(phone, greeting);
        await sendInteractiveButtons(phone, 'Inscription', [
          { id: 'new_user', title: isWolofGreeting ? 'Bindu (Nouveau)' : 'Nouveau propriétaire' },
          { id: 'existing_user', title: isWolofGreeting ? 'Bindu naa (Déjà inscrit)' : 'Déjà inscrit' },
        ]);
        await updateSession(phone, { state: 'ONBOARDING_START', data: { language: isWolofGreeting ? 'wo' : 'fr' } });
      }
      return;
    }

    // AI-powered intent detection for free text in IDLE state
    if (session.state === 'IDLE') {
      const { intent, language } = await detectIntent(text);
      console.log(`[ROUTER] AI detected intent: ${intent}, language: ${language}`);

      if (intent === 'register_landlord' && !session.landlord_id) {
        const msg = language === 'wo'
          ? "Waaw, dinaa la dimbal ak inscription bi. Jox ma sa tur bu bees."
          : "Parfait, je vais vous aider à vous inscrire. Quel est votre nom complet ?";
        await sendMessage(phone, msg);
        await updateSession(phone, { state: 'ONBOARDING_NAME', data: { language } });
        return;
      }

      if (intent === 'checkin_guest' && session.landlord_id) {
        const msg = language === 'wo'
          ? "Yégle locataire bu bees. Yónne ma nataal passeport walla CNI bi."
          : "Enregistrement d'un nouveau locataire. Veuillez envoyer une photo du passeport ou de la CNI.";
        await sendMessage(phone, msg);
        await updateSession(phone, { state: 'GUEST_CHECKIN_DOCUMENT', data: { language } });
        return;
      }

      if (intent === 'payment' && session.landlord_id) {
        await updateSession(phone, { state: 'PAY_TPT_VIEW', data: { language } });
        await handlePayment(phone, message, { ...session, state: 'PAY_TPT_VIEW' } as any);
        return;
      }
    }
  }

  // Route based on current state
  switch (session.state) {
    case 'IDLE':
      await handleIdleState(phone, message, session);
      break;

    case 'ONBOARDING_START':
    case 'ONBOARDING_NAME':
    case 'ONBOARDING_CNI':
    case 'ONBOARDING_CNI_PHOTO':
    case 'ONBOARDING_CONFIRM':
      await handleOnboarding(phone, message, session);
      break;

    case 'ADD_PROPERTY_START':
    case 'ADD_PROPERTY_NAME':
    case 'ADD_PROPERTY_TYPE':
    case 'ADD_PROPERTY_ADDRESS':
    case 'ADD_PROPERTY_LOCATION':
    case 'ADD_PROPERTY_PHOTOS':
    case 'ADD_PROPERTY_CONFIRM':
      await handlePropertyRegistration(phone, message, session);
      break;

    case 'GUEST_CHECKIN_START':
    case 'GUEST_CHECKIN_DOCUMENT':
    case 'GUEST_CHECKIN_CONFIRM':
    case 'GUEST_CHECKIN_GUARDIAN':
      await handleGuestCheckin(phone, message, session);
      break;

    case 'PAY_TPT_VIEW':
    case 'PAY_TPT_METHOD':
    case 'PAY_TPT_CONFIRM':
      await handlePayment(phone, message, session);
      break;

    default:
      console.log(`[ROUTER] Unknown state ${session.state} for ${phone}, sending help message`);
      const result = await sendMessage(
        phone,
        "Je n'ai pas compris votre message. Tapez 'menu' pour voir les options disponibles."
      );
      console.log(`[ROUTER] sendMessage result:`, JSON.stringify(result));
  }
}

async function handleIdleState(
  phone: string,
  message: WhatsAppMessage,
  session: { landlord_id?: string; data?: { language?: string } }
): Promise<void> {
  const lang = session.data?.language || 'fr';
  const isWolof = lang === 'wo';

  // Handle interactive button/list responses
  if (message.type === 'interactive' && message.interactive) {
    const reply =
      message.interactive.button_reply?.id || message.interactive.list_reply?.id;

    switch (reply) {
      case 'add_property':
        await updateSession(phone, { state: 'ADD_PROPERTY_START' });
        const propMsg = isWolof
          ? "Baax! Ñëw ñu door bindu sa kër. Naka tudd sa établissement?"
          : "Parfait ! Commençons l'enregistrement de votre propriété.\n\nQuel est le nom de votre établissement ?";
        await sendMessage(phone, propMsg);
        await updateSession(phone, { state: 'ADD_PROPERTY_NAME' });
        break;

      case 'guest_checkin':
        await updateSession(phone, { state: 'GUEST_CHECKIN_START' });
        const checkinMsg = isWolof
          ? "Yégle locataire bu bees.\n\nYónne ma nataal passeport walla CNI bi."
          : "Enregistrement d'un nouveau locataire.\n\nVeuillez envoyer une photo du passeport ou de la CNI du client.";
        await sendMessage(phone, checkinMsg);
        await updateSession(phone, { state: 'GUEST_CHECKIN_DOCUMENT' });
        break;

      case 'pay_tpt':
        await updateSession(phone, { state: 'PAY_TPT_VIEW' });
        await handlePayment(phone, message, { ...session, state: 'PAY_TPT_VIEW' } as any);
        break;

      case 'view_history':
        const histMsg = isWolof
          ? '📊 Fonctionnalité yi ngi jëfandikuwaat.'
          : '📊 Fonctionnalité en cours de développement.';
        await sendMessage(phone, histMsg);
        break;

      default:
        await showMainMenu(phone, session.landlord_id, isWolof);
    }
  } else if (message.type === 'text' && message.text?.body) {
    // Use AI for conversational responses
    const userText = message.text.body;
    console.log(`[ROUTER] Using AI for conversational response to: "${userText}"`);

    try {
      const chatMessages: ChatMessage[] = [
        { role: 'user', content: userText }
      ];

      const aiResponse = await chat(chatMessages, {
        landlordId: session.landlord_id,
        currentFlow: 'IDLE',
      });

      // Send AI response but also suggest menu
      await sendMessage(phone, aiResponse);

      // Offer menu after AI response
      const menuPrompt = isWolof
        ? "\n\nJëfandikul 'menu' ngir gis li mën def."
        : "\n\nTapez 'menu' pour voir les options disponibles.";
      await sendMessage(phone, menuPrompt);
    } catch (error) {
      console.error('[ROUTER] AI chat error:', error);
      const fallback = isWolof
        ? "Jëfandikul 'menu' ngir gis tanneef yi."
        : "Tapez 'menu' pour voir les options disponibles.";
      await sendMessage(phone, fallback);
    }
  } else {
    const fallback = isWolof
      ? "Jëfandikul 'menu' ngir gis tanneef yi, walla 'ndimbal' ngir jot ndimbal."
      : "Tapez 'menu' pour voir les options disponibles, ou 'aide' pour obtenir de l'assistance.";
    await sendMessage(phone, fallback);
  }
}

async function showMainMenu(phone: string, landlordId?: string, isWolof: boolean = false): Promise<void> {
  if (!landlordId) {
    await sendInteractiveButtons(phone, isWolof ? 'Tàmbalee' : 'Commencer', [
      { id: 'new_user', title: isWolof ? '📝 Bindu' : '📝 Inscription' },
      { id: 'help', title: isWolof ? '❓ Ndimbal' : '❓ Aide' },
    ]);
    return;
  }

  await sendInteractiveList(
    phone,
    isWolof ? 'Menu' : 'Menu Principal',
    isWolof ? 'Lan la bëgg def?' : 'Que souhaitez-vous faire ?',
    isWolof ? 'Gis tanneef yi' : 'Voir les options',
    [
      {
        title: isWolof ? 'Yorkat' : 'Gestion',
        rows: [
          {
            id: 'add_property',
            title: isWolof ? '🏠 Yokk kër' : '🏠 Ajouter propriété',
            description: isWolof ? 'Bindu kër bu bees' : 'Enregistrer un nouveau bien',
          },
          {
            id: 'guest_checkin',
            title: isWolof ? '👤 Locataire bu bees' : '👤 Nouveau locataire',
            description: isWolof ? 'Yégle ñëw' : 'Déclarer une arrivée',
          },
          {
            id: 'guest_checkout',
            title: isWolof ? '🚪 Dem locataire' : '🚪 Départ locataire',
            description: isWolof ? 'Yégle dem' : 'Enregistrer un départ',
          },
        ],
      },
      {
        title: isWolof ? 'Fey' : 'Paiements',
        rows: [
          {
            id: 'pay_tpt',
            title: isWolof ? '💰 Fey TPT' : '💰 Payer TPT',
            description: isWolof ? 'Fey cëru tubaab' : 'Régler la taxe touristique',
          },
          {
            id: 'view_balance',
            title: isWolof ? '📊 Gis sold' : '📊 Voir solde',
            description: isWolof ? 'Xool lu des' : 'Consulter le montant dû',
          },
        ],
      },
      {
        title: isWolof ? 'Tariix' : 'Historique',
        rows: [
          {
            id: 'view_history',
            title: isWolof ? '📜 Tariix' : '📜 Historique',
            description: isWolof ? 'Gis li amee' : 'Voir les activités récentes',
          },
          {
            id: 'help',
            title: isWolof ? '❓ Ndimbal' : '❓ Aide',
            description: isWolof ? 'Laaj ndimbal' : "Obtenir de l'assistance",
          },
        ],
      },
    ]
  );
}
