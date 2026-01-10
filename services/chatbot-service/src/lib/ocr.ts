/**
 * Document OCR and Image Analysis using OpenAI GPT-4 Vision
 *
 * Handles multiple document types:
 * - CNI/Passport: Extract identity information
 * - Property photos: Validate and describe property
 * - Titre de propriété: Extract property ownership details
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// =============================================================================
// TYPES
// =============================================================================

export type DocumentCategory = 'identity' | 'property_photo' | 'property_deed' | 'unknown';

export interface ExtractedDocument {
  category: DocumentCategory;
  documentType: string;
  confidence: number;
  // Identity fields (CNI/Passport)
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
  nationality?: string;
  documentNumber?: string;
  nin?: string;
  gender?: string;
  placeOfBirth?: string;
  // Property photo fields
  propertyType?: string;
  propertyDescription?: string;
  estimatedRooms?: number;
  hasPool?: boolean;
  hasTerrace?: boolean;
  condition?: string;
  // Property deed fields
  ownerName?: string;
  propertyAddress?: string;
  propertyArea?: string;
  registrationNumber?: string;
  registrationDate?: string;
  // Raw description for any document
  rawDescription?: string;
}

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyze any image and extract relevant information based on document type
 */
export async function analyzeImage(imageBuffer: Buffer): Promise<ExtractedDocument | null> {
  if (!OPENAI_API_KEY) {
    console.error('[OCR] OpenAI API key not configured');
    return null;
  }

  try {
    const base64 = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg';

    console.log('[OCR] Calling GPT-4 Vision for image analysis...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Tu es un système expert d'analyse de documents pour une plateforme de gestion d'hébergements touristiques au Sénégal.

Analyse cette image et détermine son type, puis extrait les informations pertinentes.

## TYPES DE DOCUMENTS POSSIBLES

1. **DOCUMENT D'IDENTITÉ** (CNI CEDEAO, Passeport)
   - Extrait: nom, prénom, NIN, date de naissance, nationalité, genre

2. **PHOTO DE PROPRIÉTÉ** (Appartement, Maison, Chambre)
   - Décrit: type de bien, nombre de pièces estimé, équipements visibles, état général

3. **TITRE DE PROPRIÉTÉ / BAIL** (Document juridique)
   - Extrait: nom propriétaire, adresse bien, superficie, numéro enregistrement

4. **AUTRE** (Document non reconnu)
   - Décrit brièvement ce que tu vois

## FORMAT DE RÉPONSE (JSON)

{
  "category": "identity" | "property_photo" | "property_deed" | "unknown",
  "documentType": "description courte du type exact",
  "confidence": 0-100,

  // Pour identity (CNI/Passeport):
  "firstName": "",
  "lastName": "",
  "nin": "",
  "dateOfBirth": "YYYY-MM-DD",
  "nationality": "",
  "gender": "M" | "F" | "",
  "placeOfBirth": "",

  // Pour property_photo:
  "propertyType": "appartement" | "maison" | "villa" | "chambre" | "studio",
  "propertyDescription": "description détaillée",
  "estimatedRooms": nombre,
  "condition": "neuf" | "bon" | "moyen" | "à rénover",

  // Pour property_deed:
  "ownerName": "",
  "propertyAddress": "",
  "propertyArea": "",
  "registrationNumber": "",
  "registrationDate": "YYYY-MM-DD",

  // Pour tous:
  "rawDescription": "description brute de ce qui est visible"
}

IMPORTANT:
- Pour les CNI CEDEAO, le NIN est le numéro le plus important (pas le numéro de carte)
- Pour les photos de propriété, décris ce que tu vois objectivement
- Pour les titres de propriété, cherche les informations légales
- Retourne UNIQUEMENT du JSON valide, pas de markdown`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OCR] OpenAI API error:', errorText);
      return null;
    }

    const result = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result.choices?.[0]?.message?.content || '';

    console.log('[OCR] GPT-4 Vision response:', content);

    // Parse the JSON response
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    const extracted: ExtractedDocument = {
      category: parsed.category || 'unknown',
      documentType: parsed.documentType || 'unknown',
      confidence: parsed.confidence || 0,
      // Identity fields
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      fullName: parsed.firstName && parsed.lastName
        ? `${parsed.firstName} ${parsed.lastName}`.trim()
        : undefined,
      dateOfBirth: parsed.dateOfBirth,
      nationality: parsed.nationality,
      documentNumber: parsed.documentNumber,
      nin: parsed.nin || parsed.NIN,
      gender: parsed.gender,
      placeOfBirth: parsed.placeOfBirth,
      // Property photo fields
      propertyType: parsed.propertyType,
      propertyDescription: parsed.propertyDescription,
      estimatedRooms: parsed.estimatedRooms,
      hasPool: parsed.hasPool,
      hasTerrace: parsed.hasTerrace,
      condition: parsed.condition,
      // Property deed fields
      ownerName: parsed.ownerName,
      propertyAddress: parsed.propertyAddress,
      propertyArea: parsed.propertyArea,
      registrationNumber: parsed.registrationNumber,
      registrationDate: parsed.registrationDate,
      // Raw
      rawDescription: parsed.rawDescription,
    };

    console.log('[OCR] Extracted:', extracted);
    return extracted;

  } catch (error) {
    console.error('[OCR] Error:', error);
    return null;
  }
}

// =============================================================================
// LEGACY FUNCTION (for backward compatibility)
// =============================================================================

/**
 * Extract identity information from a document image
 * @deprecated Use analyzeImage instead
 */
export async function extractDocumentInfo(imageBuffer: Buffer): Promise<ExtractedDocument | null> {
  return analyzeImage(imageBuffer);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format extracted document info for display in chat
 */
export function formatExtractedInfo(doc: ExtractedDocument): string {
  const lines: string[] = [];

  switch (doc.category) {
    case 'identity':
      lines.push(`📋 Document d'identité détecté (${doc.documentType})`);
      if (doc.fullName) lines.push(`👤 Nom: ${doc.fullName}`);
      if (doc.nin) lines.push(`🔢 NIN: ${doc.nin}`);
      if (doc.dateOfBirth) lines.push(`📅 Date de naissance: ${doc.dateOfBirth}`);
      if (doc.nationality) lines.push(`🌍 Nationalité: ${doc.nationality}`);
      break;

    case 'property_photo':
      lines.push(`🏠 Photo de propriété détectée`);
      if (doc.propertyType) lines.push(`📍 Type: ${doc.propertyType}`);
      if (doc.estimatedRooms) lines.push(`🚪 Pièces estimées: ${doc.estimatedRooms}`);
      if (doc.condition) lines.push(`✨ État: ${doc.condition}`);
      if (doc.propertyDescription) lines.push(`📝 ${doc.propertyDescription}`);
      break;

    case 'property_deed':
      lines.push(`📜 Titre de propriété détecté`);
      if (doc.ownerName) lines.push(`👤 Propriétaire: ${doc.ownerName}`);
      if (doc.propertyAddress) lines.push(`📍 Adresse: ${doc.propertyAddress}`);
      if (doc.propertyArea) lines.push(`📐 Surface: ${doc.propertyArea}`);
      if (doc.registrationNumber) lines.push(`🔢 N° enregistrement: ${doc.registrationNumber}`);
      break;

    default:
      lines.push(`❓ Document non reconnu`);
      if (doc.rawDescription) lines.push(doc.rawDescription);
  }

  lines.push(`\n📊 Confiance: ${doc.confidence}%`);
  return lines.join('\n');
}
