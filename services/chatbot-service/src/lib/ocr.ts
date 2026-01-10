/**
 * Document OCR using OpenAI GPT-4 Vision
 *
 * Extracts identity information from passport and CNI photos
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface ExtractedDocument {
  documentType: 'passport' | 'cni' | 'other';
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  documentNumber: string;
  cniNumber: string;
  gender: 'M' | 'F' | '';
  placeOfBirth: string;
  confidence: number;
}

/**
 * Extract identity information from a document image using GPT-4 Vision
 */
export async function extractDocumentInfo(imageBuffer: Buffer): Promise<ExtractedDocument | null> {
  if (!OPENAI_API_KEY) {
    console.error('[OCR] OpenAI API key not configured');
    return null;
  }

  try {
    const base64 = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg';

    console.log('[OCR] Calling GPT-4 Vision for document extraction...');

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
                text: `Tu es un système expert d'OCR pour documents d'identité sénégalais et passeports.

Extrait TOUTES les informations de ce document d'identité.

Retourne un objet JSON avec EXACTEMENT ces champs (utilise une chaîne vide si non trouvé):
{
  "documentType": "passport" ou "cni" ou "other",
  "lastName": "NOM DE FAMILLE exactement comme écrit",
  "firstName": "PRÉNOMS exactement comme écrits",
  "dateOfBirth": "format YYYY-MM-DD",
  "nationality": "Pays",
  "documentNumber": "Numéro du document (passeport ou CNI)",
  "gender": "M" ou "F",
  "placeOfBirth": "Lieu de naissance"
}

IMPORTANT pour les CNI sénégalaises:
- Le numéro CNI est généralement au format: 1 XXX XXXX XXXXX (13 chiffres)
- Cherche "N°" ou "Numéro" suivi de chiffres
- Le nom complet peut être sur une ou plusieurs lignes

Retourne UNIQUEMENT du JSON valide, pas de markdown ni d'explication.`
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
        max_tokens: 1000,
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
      documentType: parsed.documentType || 'other',
      firstName: parsed.firstName || '',
      lastName: parsed.lastName || '',
      fullName: `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim(),
      dateOfBirth: parsed.dateOfBirth || '',
      nationality: parsed.nationality || '',
      documentNumber: parsed.documentNumber || '',
      cniNumber: parsed.documentNumber || '',
      gender: parsed.gender || '',
      placeOfBirth: parsed.placeOfBirth || '',
      confidence: calculateConfidence(parsed),
    };

    console.log('[OCR] Extracted:', extracted);
    return extracted;

  } catch (error) {
    console.error('[OCR] Error:', error);
    return null;
  }
}

function calculateConfidence(data: Record<string, string>): number {
  const importantFields = [
    'documentType',
    'lastName',
    'firstName',
    'dateOfBirth',
    'documentNumber',
    'gender',
  ];

  let fieldsFound = 0;
  for (const field of importantFields) {
    if (data[field] && data[field].trim() !== '') {
      fieldsFound++;
    }
  }

  return Math.round((fieldsFound / importantFields.length) * 100);
}
