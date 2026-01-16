import { GoogleGenerativeAI } from '@google/generative-ai';
import { QueryResult } from './types';
import { RESPONSE_FORMAT_PROMPT } from './system-prompt';

export async function formatResponse(
  queryResult: QueryResult,
  originalQuestion: string
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    // Fallback to simple formatting if no API key
    return formatSimple(queryResult);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const dataDescription = JSON.stringify(queryResult, null, 2);

    const prompt = `${RESPONSE_FORMAT_PROMPT}

Question de l'utilisateur: ${originalQuestion}

Données à formater:
${dataDescription}

Formule une réponse naturelle et informative en français.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return response.trim();
  } catch (error) {
    console.error('Error formatting response with Gemini:', error);
    return formatSimple(queryResult);
  }
}

function formatSimple(queryResult: QueryResult): string {
  switch (queryResult.type) {
    case 'count':
      return `${queryResult.title}: **${queryResult.value}**`;

    case 'stats':
      return `${queryResult.title}: **${queryResult.value}**`;

    case 'details':
      if (!queryResult.items || queryResult.items.length === 0) {
        return queryResult.title || 'Aucun résultat trouvé.';
      }
      const item = queryResult.items[0] as Record<string, unknown>;
      const details = Object.entries(item)
        .filter(([key]) => queryResult.columns?.includes(key))
        .map(([key, value]) => `- **${formatLabel(key)}**: ${formatValue(value)}`)
        .join('\n');
      return `${queryResult.title}\n\n${details}`;

    case 'list':
    case 'table':
      if (!queryResult.items || queryResult.items.length === 0) {
        return queryResult.title || 'Aucun résultat trouvé.';
      }

      const summary = typeof queryResult.value === 'number' || typeof queryResult.value === 'string'
        ? `Total: ${queryResult.value}\n\n`
        : '';

      if (queryResult.items.length <= 5) {
        const list = queryResult.items
          .map((item, i) => {
            const displayItem = item as Record<string, unknown>;
            const firstCol = queryResult.columns?.[0] || Object.keys(displayItem)[0];
            return `${i + 1}. ${displayItem[firstCol]}`;
          })
          .join('\n');
        return `${queryResult.title}\n\n${summary}${list}`;
      }

      return `${queryResult.title}\n\n${summary}${queryResult.items.length} éléments trouvés.`;

    default:
      return JSON.stringify(queryResult, null, 2);
  }
}

function formatLabel(key: string): string {
  const labels: Record<string, string> = {
    name: 'Nom',
    type: 'Type',
    city: 'Ville',
    region: 'Région',
    address: 'Adresse',
    num_rooms: 'Chambres',
    status: 'Statut',
    registration_number: 'N° Enregistrement',
    severity: 'Sévérité',
    title: 'Titre',
    created_at: 'Date création',
  };
  return labels[key] || key;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }
  if (value instanceof Date) {
    return value.toLocaleDateString('fr-FR');
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString('fr-FR');
  }
  return String(value);
}
