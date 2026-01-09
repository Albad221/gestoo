import { NextRequest, NextResponse } from 'next/server';

/**
 * Document OCR API - Extract passport/CNI data using OpenAI GPT-4 Vision
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ExtractedDocument {
  documentType: 'passport' | 'cni' | 'other';
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  documentNumber: string;
  documentExpiry: string;
  documentIssue: string;
  gender: 'M' | 'F' | '';
  placeOfBirth: string;
  personalNumber: string;
  issuingAuthority: string;
  mrz: string;
  rawText: string;
  confidence: number;
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('document') as File;

    if (!file) {
      return NextResponse.json({ error: 'No document file provided' }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    // Call OpenAI GPT-4 Vision API
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
                text: `You are an expert document OCR system. Extract ALL information from this identity document (passport or national ID card).

Return a JSON object with EXACTLY these fields (use empty string if not found):
{
  "documentType": "passport" or "cni" or "other",
  "lastName": "SURNAME/FAMILY NAME exactly as written",
  "firstName": "GIVEN NAMES exactly as written",
  "dateOfBirth": "YYYY-MM-DD format",
  "nationality": "Country name or code",
  "documentNumber": "Document/Passport number",
  "documentExpiry": "YYYY-MM-DD format (expiration date)",
  "documentIssue": "YYYY-MM-DD format (issue/delivery date)",
  "gender": "M" or "F",
  "placeOfBirth": "City/Location",
  "personalNumber": "Personal/National ID number if present",
  "issuingAuthority": "Authority that issued the document",
  "mrz": "Full MRZ (Machine Readable Zone) - the 2 lines at bottom with < characters",
  "rawText": "All visible text transcribed"
}

IMPORTANT:
- Read the MRZ carefully - it contains encoded data
- Distinguish between ISSUE date and EXPIRY date
- For Senegalese passports: "Date de délivrance" = issue date, "Date d'expiration" = expiry date
- Transcribe names EXACTLY as written (check MRZ to verify spelling)
- Return ONLY valid JSON, no markdown or explanation`
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
      console.error('OpenAI API error:', errorText);
      return NextResponse.json(
        { error: 'OCR processing failed', details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    let extracted: ExtractedDocument;
    try {
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      extracted = {
        documentType: parsed.documentType || 'other',
        firstName: parsed.firstName || '',
        lastName: parsed.lastName || '',
        dateOfBirth: parsed.dateOfBirth || '',
        nationality: parsed.nationality || '',
        documentNumber: parsed.documentNumber || '',
        documentExpiry: parsed.documentExpiry || '',
        documentIssue: parsed.documentIssue || '',
        gender: parsed.gender || '',
        placeOfBirth: parsed.placeOfBirth || '',
        personalNumber: parsed.personalNumber || '',
        issuingAuthority: parsed.issuingAuthority || '',
        mrz: parsed.mrz || '',
        rawText: parsed.rawText || '',
        confidence: calculateConfidence(parsed),
      };
    } catch (parseError) {
      console.error('Failed to parse OCR response:', content);
      extracted = {
        documentType: 'other',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        nationality: '',
        documentNumber: '',
        documentExpiry: '',
        documentIssue: '',
        gender: '',
        placeOfBirth: '',
        personalNumber: '',
        issuingAuthority: '',
        mrz: '',
        rawText: content,
        confidence: 0,
      };
    }

    return NextResponse.json({
      success: true,
      extracted,
      rawText: extracted.rawText,
    });
  } catch (error) {
    console.error('Document OCR error:', error);
    return NextResponse.json(
      { error: 'Failed to process document', details: String(error) },
      { status: 500 }
    );
  }
}

function calculateConfidence(data: Record<string, string>): number {
  const importantFields = [
    'documentType',
    'lastName',
    'firstName',
    'dateOfBirth',
    'documentNumber',
    'documentExpiry',
    'gender',
    'nationality',
    'mrz',
  ];

  let fieldsFound = 0;
  for (const field of importantFields) {
    if (data[field] && data[field].trim() !== '') {
      fieldsFound++;
    }
  }

  return Math.round((fieldsFound / importantFields.length) * 100);
}
