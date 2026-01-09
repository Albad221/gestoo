# Gestoo - WhatsApp Chatbot Documentation

## Overview

The Gestoo WhatsApp chatbot allows landlords to manage their properties, register guests, and pay taxes directly through WhatsApp. The bot uses a state machine pattern to manage conversation flows.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHATBOT SERVICE                             │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐   │
│  │  Express    │──►│   Router    │──►│   Flow Handlers     │   │
│  │  Webhook    │   │             │   │                     │   │
│  └─────────────┘   └─────────────┘   │  - Onboarding       │   │
│                                       │  - Property         │   │
│  ┌─────────────┐   ┌─────────────┐   │  - Guest Check-in   │   │
│  │   Session   │◄─►│    Redis    │   │  - Guest Checkout   │   │
│  │   Manager   │   │             │   │  - Payment          │   │
│  └─────────────┘   └─────────────┘   └─────────────────────┘   │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐   │
│  │  WhatsApp   │──►│  WATI API   │──►│  WhatsApp Business  │   │
│  │   Client    │   │             │   │                     │   │
│  └─────────────┘   └─────────────┘   └─────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Machine

### State Definitions

```typescript
type ChatbotState =
  | 'IDLE'                    // Waiting for user input

  // Onboarding Flow
  | 'ONBOARDING_START'        // Initial registration choice
  | 'ONBOARDING_NAME'         // Collecting full name
  | 'ONBOARDING_CNI'          // Collecting CNI number
  | 'ONBOARDING_CNI_PHOTO'    // Collecting CNI photo
  | 'ONBOARDING_CONFIRM'      // Confirming registration

  // Property Registration Flow
  | 'ADD_PROPERTY_START'      // Starting property registration
  | 'ADD_PROPERTY_NAME'       // Property name input
  | 'ADD_PROPERTY_TYPE'       // Property type selection
  | 'ADD_PROPERTY_ADDRESS'    // Address input
  | 'ADD_PROPERTY_LOCATION'   // GPS location capture
  | 'ADD_PROPERTY_PHOTOS'     // Photo upload
  | 'ADD_PROPERTY_CONFIRM'    // Confirming property details

  // Guest Check-in Flow
  | 'GUEST_CHECKIN_START'     // Starting check-in
  | 'GUEST_CHECKIN_DOCUMENT'  // Document photo capture
  | 'GUEST_CHECKIN_CONFIRM'   // Confirming guest details
  | 'GUEST_CHECKIN_GUARDIAN'  // Guardian info for minors

  // Guest Checkout Flow
  | 'GUEST_CHECKOUT_SELECT'   // Selecting guest to checkout
  | 'GUEST_CHECKOUT_CONFIRM'  // Confirming checkout

  // Payment Flow
  | 'PAY_TPT_VIEW'            // Viewing outstanding balance
  | 'PAY_TPT_METHOD'          // Selecting payment method
  | 'PAY_TPT_CONFIRM'         // Confirming payment

  // Utility States
  | 'VIEW_HISTORY'            // Viewing activity history
  | 'VIEW_BALANCE'            // Viewing TPT balance
  | 'HELP';                   // Help information
```

### State Transitions

```
                            ┌──────────────────────────────────────┐
                            │                                      │
                            ▼                                      │
┌────────────────┐      ┌──────┐                                   │
│ First Message  │─────►│ IDLE │◄──────────────────────────────────┤
└────────────────┘      └──┬───┘                                   │
                           │                                       │
        ┌──────────────────┼──────────────────────────┐            │
        │                  │                          │            │
        ▼                  ▼                          ▼            │
┌───────────────┐  ┌───────────────┐         ┌───────────────┐     │
│  ONBOARDING   │  │   PROPERTY    │         │    PAYMENT    │     │
│    FLOW       │  │     FLOW      │         │     FLOW      │     │
├───────────────┤  ├───────────────┤         ├───────────────┤     │
│ START         │  │ NAME          │         │ VIEW          │     │
│ NAME          │  │ TYPE          │         │ METHOD        │     │
│ CNI           │  │ ADDRESS       │         │ CONFIRM       │     │
│ CNI_PHOTO     │  │ LOCATION      │         └───────┬───────┘     │
│ CONFIRM       │  │ PHOTOS        │                 │             │
└───────┬───────┘  │ CONFIRM       │                 │             │
        │          └───────┬───────┘                 │             │
        │                  │                         │             │
        └──────────────────┴─────────────────────────┴─────────────┘
```

---

## Conversation Flows

### 1. Onboarding Flow

New landlord registration process.

```
User: Bonjour

Bot: Bienvenue sur Gestoo!
     Je suis votre assistant pour la gestion de vos hebergements.
     Etes-vous deja inscrit sur notre plateforme?

     [Nouveau proprietaire] [Deja inscrit]

User: [Nouveau proprietaire]

Bot: Bienvenue! Pour vous inscrire, j'ai besoin de quelques informations.
     Quel est votre nom complet?

User: Mamadou Diallo

Bot: Merci, Mamadou Diallo!
     Maintenant, veuillez entrer votre numero de CNI.

User: 1234567890123

Bot: Parfait! Pour verifier votre identite, veuillez envoyer une photo de votre CNI.

User: [Photo]

Bot: Photo recue!

     Recapitulatif de votre inscription:
     - Nom: Mamadou Diallo
     - CNI: 1234567890123
     - Telephone: +221771234567

     Confirmez-vous ces informations?

     [Confirmer] [Recommencer]

User: [Confirmer]

Bot: Felicitations, Mamadou Diallo!
     Votre compte Gestoo a ete cree avec succes.

     Vous pouvez maintenant:
     - Enregistrer vos proprietes
     - Declarer vos locataires
     - Payer la TPT

     Tapez 'menu' pour commencer!
```

---

### 2. Property Registration Flow

Register a new property.

```
User: [Menu] > Ajouter propriete

Bot: Parfait! Commencons l'enregistrement de votre propriete.
     Quel est le nom de votre etablissement?

User: Hotel Teranga

Bot: Quel type de propriete souhaitez-vous enregistrer?

     [Hotel] [Meuble] [Maison d'hotes] [Location courte duree]

User: [Hotel]

Bot: Parfait!
     Quelle est l'adresse complete de votre propriete?
     (Ex: 12 Rue Felix Faure, Plateau, Dakar)

User: 45 Avenue Cheikh Anta Diop, Fann, Dakar

Bot: Pour localiser precisement votre propriete,
     veuillez partager votre position GPS.
     Appuyez sur "+" puis "Position" pour partager.

     [Passer cette etape]

User: [Position GPS partagee]

Bot: Envoyez maintenant des photos de votre propriete.
     Envoyez au moins 1 photo, puis tapez "termine" quand vous avez fini.

User: [Photo 1]
Bot: Photo 1 recue! Vous pouvez envoyer d'autres photos ou taper 'termine'.

User: [Photo 2]
Bot: Photo 2 recue! Vous pouvez envoyer d'autres photos ou taper 'termine'.

User: termine

Bot: Recapitulatif de votre propriete:

     - Nom: Hotel Teranga
     - Type: Hotel
     - Adresse: 45 Avenue Cheikh Anta Diop, Fann, Dakar
     - GPS: Oui
     - Photos: 2

     Confirmez-vous ces informations?

     [Confirmer] [Recommencer]

User: [Confirmer]

Bot: Propriete enregistree avec succes!

     Votre demande est en cours de verification.
     Une fois validee, vous recevrez votre numero de licence Gestoo.

     Tapez 'menu' pour continuer.
```

---

### 3. Guest Check-in Flow

Register a new guest.

```
User: [Menu] > Nouveau locataire

Bot: Enregistrement d'un nouveau locataire.
     Veuillez envoyer une photo du passeport ou de la CNI du client.

User: [Photo du passeport]

Bot: Document analyse avec succes!

     Informations detectees:
     - Nom: Jean Dupont
     - Nationalite: Francais
     - Date de naissance: 15/03/1985
     - N° Passeport: AB123456

     Ces informations sont-elles correctes?

     [Confirmer] [Corriger]

User: [Confirmer]

Bot: Parfait! Combien de nuits le client va-t-il rester?

User: 3

Bot: Sejour enregistre:
     - Client: Jean Dupont
     - Arrive: 15 janvier 2024
     - Duree: 3 nuits
     - TPT estimee: 3,000 FCFA

     Vous recevrez un rappel a la fin du sejour.

     Tapez 'menu' pour continuer.
```

---

### 4. Guest Check-in (Minor) Flow

Special flow for guests under 18.

```
User: [Photo du document]

Bot: ATTENTION: Ce client est mineur (15 ans)

     Un accompagnateur majeur est-il present?

     [Oui, avec accompagnateur] [Non, seul]

User: [Oui, avec accompagnateur]

Bot: Veuillez entrer les informations de l'accompagnateur:
     - Nom complet
     - Lien avec le mineur (parent, tuteur, etc.)

User: Marie Dupont, mere

Bot: Parfait. Veuillez envoyer une photo de la piece d'identite de l'accompagnateur.

User: [Photo CNI]

Bot: Accompagnateur enregistre:
     - Nom: Marie Dupont
     - Relation: Mere

     Sejour enregistre avec accompagnateur.

     Note: Un signalement de routine a ete transmis conformement a la reglementation.
```

---

### 5. Payment Flow

Pay outstanding TPT.

```
User: [Menu] > Payer TPT

Bot: Solde TPT a payer

     - Nombre de declarations: 3
     - Montant total: 15,000 FCFA

     Comment souhaitez-vous payer?

     [Wave] [Orange Money] [Annuler]

User: [Wave]

Bot: Paiement Wave

     - Montant: 15,000 FCFA
     - Numero: +221771234567

     Confirmez-vous ce paiement?

     [Payer maintenant] [Annuler]

User: [Payer maintenant]

Bot: Initialisation du paiement...

     Une demande de paiement Wave a ete envoyee a votre telephone.

     - Verifiez votre application Wave
     - Montant: 15,000 FCFA
     - Entrez votre code PIN pour confirmer

     Vous recevrez une confirmation une fois le paiement effectue.

[Apres confirmation Wave]

Bot: Paiement recu!

     - Montant: 15,000 FCFA
     - Recu: TRG-1704067200

     Merci pour votre contribution au developpement du tourisme senegalais!

     Tapez 'menu' pour continuer.
```

---

## Message Formats

### Text Messages

Simple text replies:

```typescript
await sendMessage(phone, "Votre message ici");
```

### Interactive Buttons

Up to 3 buttons:

```typescript
await sendInteractiveButtons(phone, "Choisissez une option", [
  { id: "option_1", title: "Option 1" },
  { id: "option_2", title: "Option 2" },
  { id: "option_3", title: "Option 3" }
]);
```

### Interactive Lists

For more options:

```typescript
await sendInteractiveList(
  phone,
  "Menu Principal",           // Header
  "Que souhaitez-vous faire?", // Body
  "Voir les options",         // Button text
  [
    {
      title: "Gestion",
      rows: [
        { id: "add_property", title: "Ajouter propriete", description: "Enregistrer un nouveau bien" },
        { id: "guest_checkin", title: "Nouveau locataire", description: "Declarer une arrivee" }
      ]
    },
    {
      title: "Paiements",
      rows: [
        { id: "pay_tpt", title: "Payer TPT", description: "Regler la taxe touristique" }
      ]
    }
  ]
);
```

### Media Messages

Send images or documents:

```typescript
await sendMedia(
  phone,
  "https://storage.supabase.co/receipts/REC-001.pdf",
  "Votre recu de paiement",
  "recu_tpt.pdf"
);
```

---

## WATI Integration

### Configuration

```typescript
const WATI_API_URL = "https://live-server-XXXXX.wati.io";
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
```

### Webhook Setup

Configure in WATI Dashboard:
- Webhook URL: `https://your-service.com/webhook`
- Events: `message.received`

### Webhook Payload

```json
{
  "id": "msg-id",
  "waId": "221771234567",
  "senderName": "User Name",
  "text": "Message content",
  "type": "text",
  "timestamp": "1704067200",
  "listReply": {
    "id": "option_id",
    "title": "Option Title",
    "description": "Option description"
  }
}
```

### API Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| Send Text | `POST /sendSessionMessage/{phone}` | Send text message |
| Send Buttons | `POST /sendInteractiveButtonsMessage` | Send interactive buttons |
| Send List | `POST /sendInteractiveListMessage` | Send interactive list |
| Send Media | `POST /sendSessionFile/{phone}` | Send file/image |
| Get Media | `POST /getMedia` | Download received media |
| Send Template | `POST /sendTemplateMessage` | Send approved template |

---

## Session Management

### Session Structure

```typescript
interface ChatbotSession {
  phone: string;
  state: ChatbotState;
  landlord_id?: string;
  property_id?: string;
  guest_id?: string;
  stay_id?: string;
  data: Record<string, unknown>;  // Flow-specific data
  last_activity: string;
  language: 'fr' | 'wo' | 'en';
}
```

### Redis Storage

```typescript
// Get session
const session = await redis.get(`session:${phone}`);

// Update session
await redis.set(`session:${phone}`, JSON.stringify({
  ...session,
  state: 'ONBOARDING_NAME',
  data: { full_name: 'John Doe' }
}));

// Session expiry: 24 hours
await redis.expire(`session:${phone}`, 86400);
```

---

## Keywords and Commands

| Keyword | Action |
|---------|--------|
| `bonjour`, `salut`, `hello` | Start conversation / Show main menu |
| `menu`, `accueil`, `home` | Show main menu |
| `aide`, `help` | Show help information |
| `annuler`, `cancel` | Cancel current flow |
| `termine`, `fini`, `done` | Complete current step |

---

## Error Handling

### User Input Errors

```typescript
if (message.type !== 'text') {
  await sendMessage(phone, "Veuillez entrer votre reponse en texte.");
  return;
}

if (input.length < 3) {
  await sendMessage(phone, "Votre reponse semble trop courte. Veuillez reessayer.");
  return;
}
```

### API Errors

```typescript
try {
  await sendMessage(phone, "Message");
} catch (error) {
  console.error('WATI API error:', error);
  // Retry logic or fallback
}
```

### Session Recovery

```typescript
if (!session || session.state === undefined) {
  await updateSession(phone, { state: 'IDLE' });
  await sendMessage(phone, "Session reinitalisee. Tapez 'menu' pour continuer.");
}
```

---

## Multi-language Support

### Supported Languages

| Code | Language |
|------|----------|
| `fr` | French (default) |
| `wo` | Wolof |
| `en` | English |

### Language Detection

```typescript
// Detect from user's first message
const wolofKeywords = ['nagadef', 'jamm', 'degg'];
const englishKeywords = ['hello', 'hi', 'help'];

if (wolofKeywords.some(kw => text.includes(kw))) {
  session.language = 'wo';
} else if (englishKeywords.some(kw => text.includes(kw))) {
  session.language = 'en';
}
```

---

## Testing

### Local Development

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start chatbot service
cd services/chatbot-service
pnpm dev
```

### Webhook Testing

Use ngrok to expose local server:

```bash
ngrok http 4000
# Configure WATI webhook with ngrok URL
```

### Mock Messages

```bash
curl -X POST http://localhost:4000/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "waId": "221771234567",
    "text": "Bonjour",
    "type": "text"
  }'
```
