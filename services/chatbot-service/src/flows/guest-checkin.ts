import type { WhatsAppMessage, ChatbotSession, DocumentType } from '@gestoo/types';
import { updateSession } from '../lib/session.js';
import { sendMessage, sendInteractiveButtons, downloadMedia } from '../lib/wati.js';
import { supabase } from '../lib/supabase.js';
import { analyzeDocument, type DocumentAnalysisResult } from '../lib/gemini.js';
import {
  verifyGuest,
  storeVerificationResult,
  createHighRiskAlert,
  type VerificationResult,
  type RiskLevel,
} from '../lib/verification.js';

type OCRDocumentType = 'passport' | 'national_id' | 'residence_permit' | 'other';

interface GuestData {
  firstName?: string;
  lastName?: string;
  nationality?: string;
  documentType?: DocumentType | OCRDocumentType;
  documentNumber?: string;
  dateOfBirth?: string;
  isMinor?: boolean;
  age?: number;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
  propertyId?: string;
  nights?: number;
  numGuests?: number;
  // Verification data
  verificationResult?: VerificationResult;
  isHighRisk?: boolean;
}

export async function handleGuestCheckin(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession
): Promise<void> {
  const guestData: GuestData = session.data?.guest || {};

  switch (session.state) {
    case 'GUEST_CHECKIN_START':
      await handleStart(phone, session, guestData);
      break;

    case 'GUEST_CHECKIN_PROPERTY':
      await handlePropertySelection(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_DOCUMENT':
      await handleDocumentUpload(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_CONFIRM_DATA':
      await handleDataConfirmation(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_MANUAL_NAME':
      await handleManualName(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_MANUAL_DOC_TYPE':
      await handleManualDocType(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_MANUAL_DOC_NUM':
      await handleManualDocNumber(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_MANUAL_NATIONALITY':
      await handleManualNationality(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_MANUAL_DOB':
      await handleManualDOB(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_GUARDIAN':
      await handleGuardianInfo(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_GUARDIAN_PHONE':
      await handleGuardianPhone(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_NIGHTS':
      await handleNights(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_NUM_GUESTS':
      await handleNumGuests(phone, message, session, guestData);
      break;

    case 'GUEST_CHECKIN_CONFIRM':
      await handleFinalConfirmation(phone, message, session, guestData);
      break;

    default:
      await sendMessage(phone, "Une erreur s'est produite. Tapez 'menu' pour recommencer.");
      await updateSession(phone, { state: 'IDLE' });
  }
}

async function handleStart(
  phone: string,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  // Get landlord's properties
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, city')
    .eq('landlord_id', session.landlord_id)
    .eq('status', 'active');

  if (!properties || properties.length === 0) {
    await sendMessage(
      phone,
      `Vous n'avez pas encore de propriete active.

Veuillez d'abord enregistrer une propriete.`
    );
    await updateSession(phone, { state: 'IDLE' });
    return;
  }

  if (properties.length === 1) {
    guestData.propertyId = properties[0].id;
    await updateSession(phone, {
      state: 'GUEST_CHECKIN_DOCUMENT',
      data: { ...session.data, guest: guestData },
    });
    await sendMessage(
      phone,
      `📍 ${properties[0].name}

📸 Envoyez une photo du passeport ou CNI du client.

Ou tapez 'manuel' pour saisir manuellement.`
    );
  } else {
    await sendMessage(
      phone,
      `Selectionnez la propriete:

` +
      properties.map((p, i) => `${i + 1}. ${p.name} (${p.city})`).join('\n') +
      `

Repondez avec le numero.`
    );
    await updateSession(phone, {
      state: 'GUEST_CHECKIN_PROPERTY',
      data: { ...session.data, guest: guestData, properties },
    });
  }
}

async function handlePropertySelection(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) {
    await sendMessage(phone, 'Entrez le numero de la propriete.');
    return;
  }

  const selection = parseInt(message.text.body.trim());
  const properties = (session.data?.properties || []) as Array<{ id: string; name: string; city: string }>;

  if (isNaN(selection) || selection < 1 || selection > properties.length) {
    await sendMessage(phone, `Entrez un numero entre 1 et ${properties.length}.`);
    return;
  }

  guestData.propertyId = properties[selection - 1].id;

  await updateSession(phone, {
    state: 'GUEST_CHECKIN_DOCUMENT',
    data: { ...session.data, guest: guestData },
  });

  await sendMessage(
    phone,
    `📍 ${properties[selection - 1].name}

📸 Envoyez une photo du passeport ou CNI.

Ou tapez 'manuel' pour saisir manuellement.`
  );
}

async function handleDocumentUpload(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  const lang = session.data?.language || 'fr';
  const isWolof = lang === 'wo';

  // Manual entry option
  if (message.type === 'text' && message.text?.body.toLowerCase() === 'manuel') {
    const msg = isWolof
      ? "📝 Bind ak loxo\n\nTur bu bees bi? (Prenom NOM)"
      : "📝 Saisie manuelle\n\nNom complet du client? (Prenom NOM)";
    await sendMessage(phone, msg);
    await updateSession(phone, {
      state: 'GUEST_CHECKIN_MANUAL_NAME',
      data: { ...session.data, guest: guestData },
    });
    return;
  }

  if (message.type !== 'image' && message.type !== 'document') {
    const msg = isWolof
      ? "📸 Yónne nataal document bi.\n\nWalla bind 'manuel' ngir bind ak loxo."
      : "📸 Envoyez une photo du document.\n\nOu tapez 'manuel' pour saisir manuellement.";
    await sendMessage(phone, msg);
    return;
  }

  const analyzingMsg = isWolof ? "⏳ Yengi xool document bi..." : "⏳ Analyse du document...";
  await sendMessage(phone, analyzingMsg);

  try {
    const mediaId = message.image?.id || message.document?.id;
    if (!mediaId) throw new Error('No media ID');

    const imageBuffer = await downloadMedia(mediaId);

    // Use Gemini AI for document analysis
    console.log('[Check-in] Analyzing document with Gemini AI...');
    const ocrResult = await analyzeDocument(imageBuffer);

    if (!ocrResult.isValid || ocrResult.confidence < 0.5) {
      const errorMsg = isWolof
        ? `⚠️ Nataal bi duñu ko xam.\n\n${ocrResult.warnings.join('\n')}\n\nYónne nataal bu wér walla bind 'manuel'.`
        : `⚠️ Image non reconnue comme document d'identite.\n\n${ocrResult.warnings.join('\n')}\n\nRenvoyez une photo claire ou tapez 'manuel'.`;
      await sendMessage(phone, errorMsg);
      return;
    }

    // Update guest data from Gemini analysis
    const extracted = ocrResult.extractedData;
    guestData.firstName = extracted.firstName || extracted.fullName?.split(' ')[0];
    guestData.lastName = extracted.lastName || extracted.fullName?.split(' ').slice(1).join(' ');
    guestData.documentType = ocrResult.documentType as OCRDocumentType;
    guestData.documentNumber = extracted.documentNumber;
    guestData.nationality = extracted.nationality || extracted.issuingCountry;
    guestData.dateOfBirth = extracted.dateOfBirth;

    // Calculate age
    if (extracted.dateOfBirth) {
      const dob = new Date(extracted.dateOfBirth);
      const today = new Date();
      guestData.age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      guestData.isMinor = guestData.age < 18;
    }

    const docTypes: Record<string, string> = {
      passport: 'Passeport',
      national_id: 'CNI',
      residence_permit: 'Titre de sejour',
      other: 'Document',
    };

    let msg = `✅ Document lu!\n\n`;
    msg += `📄 ${docTypes[guestData.documentType || 'other']}\n`;
    msg += `👤 ${guestData.firstName || '?'} ${guestData.lastName || '?'}\n`;
    msg += `🔢 ${guestData.documentNumber || '?'}\n`;
    msg += `🌍 ${guestData.nationality || '?'}\n`;
    msg += `📅 ${guestData.dateOfBirth || '?'}`;

    if (guestData.isMinor) {
      msg += `\n\n⚠️ MINEUR (${guestData.age} ans)`;
    }

    msg += `\n\nCorrect?`;

    await sendInteractiveButtons(phone, msg, [
      { id: 'confirm_data', title: '✅ Oui' },
      { id: 'edit_data', title: '✏️ Modifier' },
    ]);

    await updateSession(phone, {
      state: 'GUEST_CHECKIN_CONFIRM_DATA',
      data: { ...session.data, guest: guestData },
    });
  } catch (error) {
    console.error('OCR error:', error);
    await sendMessage(phone, "❌ Erreur d'analyse. Tapez 'manuel' pour saisir manuellement.");
  }
}

async function handleDataConfirmation(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  const reply = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id;

  if (reply === 'confirm_data') {
    if (guestData.isMinor) {
      await sendMessage(phone, `⚠️ Client mineur

Nom de l'accompagnateur adulte:`);
      await updateSession(phone, {
        state: 'GUEST_CHECKIN_GUARDIAN',
        data: { ...session.data, guest: guestData },
      });
    } else {
      await sendMessage(phone, "🌙 Nombre de nuits?");
      await updateSession(phone, {
        state: 'GUEST_CHECKIN_NIGHTS',
        data: { ...session.data, guest: guestData },
      });
    }
  } else if (reply === 'edit_data') {
    await sendMessage(phone, "📝 Nom complet du client? (Prenom NOM)");
    await updateSession(phone, {
      state: 'GUEST_CHECKIN_MANUAL_NAME',
      data: { ...session.data, guest: guestData },
    });
  } else {
    await sendInteractiveButtons(phone, 'Les informations sont correctes?', [
      { id: 'confirm_data', title: '✅ Oui' },
      { id: 'edit_data', title: '✏️ Modifier' },
    ]);
  }
}

async function handleManualName(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) {
    await sendMessage(phone, "Entrez le nom complet (Prenom NOM).");
    return;
  }

  const fullName = message.text.body.trim();
  const parts = fullName.split(' ');
  guestData.firstName = parts[0];
  guestData.lastName = parts.slice(1).join(' ') || parts[0];

  await sendMessage(phone, `📄 Type de document?

1. Passeport
2. CNI
3. Titre de sejour
4. Autre`);
  await updateSession(phone, {
    state: 'GUEST_CHECKIN_MANUAL_DOC_TYPE',
    data: { ...session.data, guest: guestData },
  });
}

async function handleManualDocType(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text') return;

  const docTypes: Record<string, GuestData['documentType']> = {
    '1': 'passport', '2': 'national_id', '3': 'residence_permit', '4': 'other',
  };

  const selection = message.text?.body.trim() || '';
  if (!docTypes[selection]) {
    await sendMessage(phone, "Entrez 1, 2, 3 ou 4.");
    return;
  }

  guestData.documentType = docTypes[selection];
  await sendMessage(phone, "🔢 Numero du document?");
  await updateSession(phone, {
    state: 'GUEST_CHECKIN_MANUAL_DOC_NUM',
    data: { ...session.data, guest: guestData },
  });
}

async function handleManualDocNumber(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) return;

  guestData.documentNumber = message.text.body.trim().toUpperCase();
  await sendMessage(phone, "🌍 Nationalite?");
  await updateSession(phone, {
    state: 'GUEST_CHECKIN_MANUAL_NATIONALITY',
    data: { ...session.data, guest: guestData },
  });
}

async function handleManualNationality(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) return;

  guestData.nationality = message.text.body.trim();
  await sendMessage(phone, "📅 Date de naissance? (JJ/MM/AAAA)");
  await updateSession(phone, {
    state: 'GUEST_CHECKIN_MANUAL_DOB',
    data: { ...session.data, guest: guestData },
  });
}

async function handleManualDOB(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) return;

  const dobText = message.text.body.trim();
  let dob: Date;

  if (dobText.includes('/')) {
    const [day, month, year] = dobText.split('/');
    dob = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else {
    dob = new Date(dobText);
  }

  if (isNaN(dob.getTime())) {
    await sendMessage(phone, "Date invalide. Format: JJ/MM/AAAA");
    return;
  }

  guestData.dateOfBirth = dob.toISOString().split('T')[0];
  const today = new Date();
  guestData.age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  guestData.isMinor = guestData.age < 18;

  if (guestData.isMinor) {
    await sendMessage(phone, `⚠️ Mineur (${guestData.age} ans)\n\nNom de l'accompagnateur:`);
    await updateSession(phone, {
      state: 'GUEST_CHECKIN_GUARDIAN',
      data: { ...session.data, guest: guestData },
    });
  } else {
    await sendMessage(phone, "🌙 Nombre de nuits?");
    await updateSession(phone, {
      state: 'GUEST_CHECKIN_NIGHTS',
      data: { ...session.data, guest: guestData },
    });
  }
}

async function handleGuardianInfo(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) return;

  guestData.guardianName = message.text.body.trim();
  await sendMessage(phone, "📱 Telephone de l'accompagnateur? (77XXXXXXX)");
  await updateSession(phone, {
    state: 'GUEST_CHECKIN_GUARDIAN_PHONE',
    data: { ...session.data, guest: guestData },
  });
}

async function handleGuardianPhone(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) return;

  guestData.guardianPhone = message.text.body.trim().replace(/\s/g, '');
  guestData.guardianRelationship = 'accompagnateur';

  await sendMessage(phone, "🌙 Nombre de nuits?");
  await updateSession(phone, {
    state: 'GUEST_CHECKIN_NIGHTS',
    data: { ...session.data, guest: guestData },
  });
}

async function handleNights(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) return;

  const nights = parseInt(message.text.body.trim());
  if (isNaN(nights) || nights < 1 || nights > 365) {
    await sendMessage(phone, "Entrez un nombre valide (1-365).");
    return;
  }

  guestData.nights = nights;
  await sendMessage(phone, "👥 Nombre de personnes?");
  await updateSession(phone, {
    state: 'GUEST_CHECKIN_NUM_GUESTS',
    data: { ...session.data, guest: guestData },
  });
}

async function handleNumGuests(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  if (message.type !== 'text' || !message.text?.body) return;

  const numGuests = parseInt(message.text.body.trim());
  if (isNaN(numGuests) || numGuests < 1 || numGuests > 20) {
    await sendMessage(phone, "Entrez un nombre valide (1-20).");
    return;
  }

  guestData.numGuests = numGuests;

  const tpt = 1000 * guestData.nights! * numGuests;

  let summary = `📋 RESUME\n\n`;
  summary += `👤 ${guestData.firstName} ${guestData.lastName}\n`;
  summary += `📄 ${guestData.documentNumber}\n`;
  summary += `🌍 ${guestData.nationality}\n`;
  summary += `🌙 ${guestData.nights} nuit(s)\n`;
  summary += `👥 ${numGuests} personne(s)\n`;

  if (guestData.isMinor) {
    summary += `\n⚠️ MINEUR\n`;
    summary += `👨‍👩‍👦 ${guestData.guardianName}\n`;
  }

  summary += `\n💰 TPT: ${tpt.toLocaleString('fr-FR')} FCFA`;

  await sendInteractiveButtons(phone, summary, [
    { id: 'confirm_checkin', title: '✅ Confirmer' },
    { id: 'cancel_checkin', title: '❌ Annuler' },
  ]);

  await updateSession(phone, {
    state: 'GUEST_CHECKIN_CONFIRM',
    data: { ...session.data, guest: guestData },
  });
}

async function handleFinalConfirmation(
  phone: string,
  message: WhatsAppMessage,
  session: ChatbotSession,
  guestData: GuestData
): Promise<void> {
  const reply = message.interactive?.button_reply?.id;

  if (reply === 'cancel_checkin') {
    await sendMessage(phone, `Annule.

Tapez 'menu' pour continuer.`);
    await updateSession(phone, { state: 'IDLE', data: {} });
    return;
  }

  if (reply !== 'confirm_checkin') {
    await sendInteractiveButtons(phone, 'Confirmer?', [
      { id: 'confirm_checkin', title: 'Confirmer' },
      { id: 'cancel_checkin', title: 'Annuler' },
    ]);
    return;
  }

  await sendMessage(phone, "Enregistrement et verification en cours...");

  try {
    // ==========================================================================
    // STEP 1: Guest Verification
    // ==========================================================================
    console.log('[Check-in] Starting guest verification...');

    const verificationResult = await verifyGuest({
      firstName: guestData.firstName,
      lastName: guestData.lastName,
      nationality: guestData.nationality,
      documentType: guestData.documentType,
      documentNumber: guestData.documentNumber,
      dateOfBirth: guestData.dateOfBirth,
    });

    guestData.verificationResult = verificationResult;
    guestData.isHighRisk = verificationResult.riskLevel === 'HIGH';

    console.log(`[Check-in] Verification complete: ${verificationResult.riskLevel} (${verificationResult.riskScore}/100)`);

    // ==========================================================================
    // STEP 2: Create Guest Record
    // ==========================================================================
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .insert({
        first_name: guestData.firstName,
        last_name: guestData.lastName,
        nationality: guestData.nationality,
        document_type: guestData.documentType,
        document_number: guestData.documentNumber,
        date_of_birth: guestData.dateOfBirth,
      })
      .select()
      .single();

    if (guestError) throw guestError;

    // ==========================================================================
    // STEP 3: Create Stay Record (flagged if HIGH risk)
    // ==========================================================================
    const { data: stay, error: stayError } = await supabase
      .from('stays')
      .insert({
        property_id: guestData.propertyId,
        guest_id: guest.id,
        check_in: new Date().toISOString(),
        nights: guestData.nights,
        num_guests: guestData.numGuests,
        status: 'active',
        is_accompanied: guestData.isMinor,
        guardian_name: guestData.guardianName,
        guardian_phone: guestData.guardianPhone,
        guardian_relationship: guestData.guardianRelationship,
        // Flag the stay if HIGH risk
        notes: guestData.isHighRisk
          ? `ALERTE RISQUE ELEVE - Score: ${verificationResult.riskScore}/100. Raisons: ${verificationResult.reasons.join('; ')}`
          : undefined,
      })
      .select()
      .single();

    if (stayError) throw stayError;

    // ==========================================================================
    // STEP 4: Create Tax Liability
    // ==========================================================================
    const tpt = 1000 * guestData.nights! * guestData.numGuests!;

    const { data: property } = await supabase
      .from('properties')
      .select('landlord_id')
      .eq('id', guestData.propertyId)
      .single();

    await supabase.from('tax_liabilities').insert({
      property_id: guestData.propertyId,
      landlord_id: property?.landlord_id,
      stay_id: stay.id,
      guest_nights: guestData.nights! * guestData.numGuests!,
      rate_per_night: 1000,
      amount: tpt,
      status: 'pending',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    // ==========================================================================
    // STEP 5: Store Verification Result
    // ==========================================================================
    await storeVerificationResult(
      guest.id,
      stay.id,
      guestData.propertyId!,
      verificationResult
    );

    // ==========================================================================
    // STEP 6: Handle Alerts (Minor + High Risk)
    // ==========================================================================

    // Minor alert
    if (guestData.isMinor) {
      await supabase.from('alerts').insert({
        type: 'minor_protection',
        severity: guestData.guardianName ? 'low' : 'high',
        title: 'Client mineur',
        property_id: guestData.propertyId,
        stay_id: stay.id,
        guest_id: guest.id,
        description: `Mineur: ${guestData.firstName} ${guestData.lastName} (${guestData.age} ans). Accompagnateur: ${guestData.guardianName || 'NON DECLARE'}`,
        status: 'new',
        auto_generated: true,
      });
    }

    // HIGH RISK ALERT - Create alert and notify landlord
    if (guestData.isHighRisk) {
      console.log('[Check-in] Creating HIGH RISK alert for guest:', guest.id);

      await createHighRiskAlert(
        guest.id,
        stay.id,
        guestData.propertyId!,
        verificationResult
      );
    }

    // ==========================================================================
    // STEP 7: Send Confirmation Message to Landlord
    // ==========================================================================
    let confirmationMsg = `Enregistre!\n\n`;
    confirmationMsg += `${guestData.firstName} ${guestData.lastName}\n`;
    confirmationMsg += `${guestData.documentNumber}\n`;
    confirmationMsg += `${guestData.nights} nuit(s)\n`;
    confirmationMsg += `TPT: ${tpt.toLocaleString('fr-FR')} FCFA\n`;

    // Add verification status
    if (verificationResult.riskLevel === 'LOW') {
      confirmationMsg += `\nVerification: OK`;
    } else if (verificationResult.riskLevel === 'MEDIUM') {
      confirmationMsg += `\nVerification: Attention recommandee`;
      confirmationMsg += `\nScore de risque: ${verificationResult.riskScore}/100`;
    }

    await sendMessage(phone, confirmationMsg);

    // Send HIGH RISK WARNING separately for emphasis
    if (guestData.isHighRisk) {
      const warningMsg = `ALERTE SECURITE - CLIENT A HAUT RISQUE

Score de risque: ${verificationResult.riskScore}/100

Raisons:
${verificationResult.reasons.map((r) => `- ${r}`).join('\n')}

Le sejour a ete enregistre mais signale aux autorites.

Soyez vigilant et contactez les autorites en cas de comportement suspect.`;

      await sendMessage(phone, warningMsg);
    }

    await sendMessage(phone, "Tapez 'menu' pour continuer.");

    await updateSession(phone, { state: 'IDLE', data: {} });
  } catch (error) {
    console.error('Check-in error:', error);
    await sendMessage(phone, "Erreur. Reessayez ou contactez le support.");
    await updateSession(phone, { state: 'IDLE', data: {} });
  }
}
