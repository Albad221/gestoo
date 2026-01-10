import type { WhatsAppMessage, ChatbotState } from '@gestoo/types';
import { getSession, updateSession } from '../lib/session.js';
import { sendMessage, sendInteractiveButtons, sendInteractiveList } from '../lib/wati.js';

// Flow handlers
import { handleOnboarding } from './onboarding.js';
import { handlePropertyRegistration } from './property.js';
import { handleGuestCheckin } from './guest-checkin.js';
import { handlePayment } from './payment.js';

const MENU_KEYWORDS = ['menu', 'aide', 'help', 'accueil', 'home'];
const GREETING_KEYWORDS = ['bonjour', 'salut', 'hello', 'hi', 'bonsoir'];

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

    // Check for greetings (new conversation)
    if (GREETING_KEYWORDS.includes(text) && session.state === 'IDLE') {
      console.log(`[ROUTER] Greeting detected from ${phone}`);
      if (session.landlord_id) {
        console.log(`[ROUTER] Returning user, showing main menu`);
        const result = await sendMessage(phone, `Bienvenue ! 👋\nQue souhaitez-vous faire aujourd'hui ?`);
        console.log(`[ROUTER] sendMessage result:`, JSON.stringify(result));
        await showMainMenu(phone, session.landlord_id);
      } else {
        console.log(`[ROUTER] New user, showing onboarding`);
        const result = await sendMessage(
          phone,
          `Bienvenue sur Gestoo ! 🇸🇳\n\nJe suis votre assistant pour la gestion de vos hébergements.\n\nÊtes-vous déjà inscrit sur notre plateforme ?`
        );
        console.log(`[ROUTER] sendMessage result:`, JSON.stringify(result));
        const buttonResult = await sendInteractiveButtons(phone, 'Inscription', [
          { id: 'new_user', title: 'Nouveau propriétaire' },
          { id: 'existing_user', title: 'Déjà inscrit' },
        ]);
        console.log(`[ROUTER] sendInteractiveButtons result:`, JSON.stringify(buttonResult));
        await updateSession(phone, { state: 'ONBOARDING_START' });
      }
      return;
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
  session: { landlord_id?: string }
): Promise<void> {
  // Handle interactive button/list responses
  if (message.type === 'interactive' && message.interactive) {
    const reply =
      message.interactive.button_reply?.id || message.interactive.list_reply?.id;

    switch (reply) {
      case 'add_property':
        await updateSession(phone, { state: 'ADD_PROPERTY_START' });
        await sendMessage(phone, `Parfait ! Commençons l'enregistrement de votre propriété.\n\nQuel est le nom de votre établissement ?`);
        await updateSession(phone, { state: 'ADD_PROPERTY_NAME' });
        break;

      case 'guest_checkin':
        await updateSession(phone, { state: 'GUEST_CHECKIN_START' });
        await sendMessage(phone, `Enregistrement d'un nouveau locataire.\n\nVeuillez envoyer une photo du passeport ou de la CNI du client.`);
        await updateSession(phone, { state: 'GUEST_CHECKIN_DOCUMENT' });
        break;

      case 'pay_tpt':
        await updateSession(phone, { state: 'PAY_TPT_VIEW' });
        await handlePayment(phone, message, { ...session, state: 'PAY_TPT_VIEW' } as any);
        break;

      case 'view_history':
        await sendMessage(phone, '📊 Fonctionnalité en cours de développement.');
        break;

      default:
        await showMainMenu(phone, session.landlord_id);
    }
  } else {
    await sendMessage(
      phone,
      "Tapez 'menu' pour voir les options disponibles, ou 'aide' pour obtenir de l'assistance."
    );
  }
}

async function showMainMenu(phone: string, landlordId?: string): Promise<void> {
  if (!landlordId) {
    await sendInteractiveButtons(phone, 'Commencer', [
      { id: 'new_user', title: '📝 Inscription' },
      { id: 'help', title: '❓ Aide' },
    ]);
    return;
  }

  await sendInteractiveList(
    phone,
    'Menu Principal',
    'Que souhaitez-vous faire ?',
    'Voir les options',
    [
      {
        title: 'Gestion',
        rows: [
          { id: 'add_property', title: '🏠 Ajouter propriété', description: 'Enregistrer un nouveau bien' },
          { id: 'guest_checkin', title: '👤 Nouveau locataire', description: 'Déclarer une arrivée' },
          { id: 'guest_checkout', title: '🚪 Départ locataire', description: 'Enregistrer un départ' },
        ],
      },
      {
        title: 'Paiements',
        rows: [
          { id: 'pay_tpt', title: '💰 Payer TPT', description: 'Régler la taxe touristique' },
          { id: 'view_balance', title: '📊 Voir solde', description: 'Consulter le montant dû' },
        ],
      },
      {
        title: 'Historique',
        rows: [
          { id: 'view_history', title: '📜 Historique', description: 'Voir les activités récentes' },
          { id: 'help', title: '❓ Aide', description: 'Obtenir de l\'assistance' },
        ],
      },
    ]
  );
}
