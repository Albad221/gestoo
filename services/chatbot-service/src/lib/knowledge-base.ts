/**
 * Knowledge Base Service for TPT/Landlord Tax FAQ
 * Implements RAG (Retrieval-Augmented Generation) using keyword matching and fuzzy search
 */

import { supabase } from './supabase';

// Types
export interface FAQEntry {
  id: string;
  category_id: string | null;
  question: string;
  answer: string;
  keywords: string[];
  rank?: number;
}

export interface FAQCategory {
  id: string;
  name: string;
  name_fr: string;
  description: string | null;
  sort_order: number;
}

export interface SearchResult {
  entries: FAQEntry[];
  context: string;
  queryKeywords: string[];
}

// French stop words to filter out
const FRENCH_STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
  'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'on',
  'qui', 'que', 'quoi', 'dont', 'ou', 'quand', 'comment', 'pourquoi',
  'et', 'ou', 'mais', 'donc', 'car', 'ni', 'ne', 'pas', 'plus',
  'est', 'sont', 'etre', 'avoir', 'fait', 'faire', 'peut', 'doit',
  'pour', 'par', 'sur', 'sous', 'avec', 'sans', 'dans', 'en', 'a',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'je', 'me', 'moi', 'te', 'toi', 'se', 'lui', 'y', 'en',
  'c', 'ca', 'cela', 'ceci', 'comme', 'si', 'meme', 'aussi',
  'tout', 'tous', 'toute', 'toutes', 'quel', 'quelle', 'quels', 'quelles'
]);

// Tax-related keyword synonyms for better matching
const KEYWORD_SYNONYMS: Record<string, string[]> = {
  'tpt': ['taxe propriete batie', 'contribution fonciere', 'cfpb', 'impot foncier'],
  'cfpb': ['tpt', 'taxe propriete batie', 'contribution fonciere'],
  'taxe': ['impot', 'contribution', 'redevance'],
  'impot': ['taxe', 'contribution', 'fiscalite'],
  'bailleur': ['proprietaire', 'loueur', 'landlord'],
  'proprietaire': ['bailleur', 'possesseur', 'detenteur'],
  'loyer': ['location', 'bail', 'rent', 'mensualite'],
  'enregistrement': ['inscription', 'declaration', 'formalite'],
  'paiement': ['reglement', 'versement', 'acquittement'],
  'etax': ['en ligne', 'internet', 'plateforme', 'dgid'],
  'penalite': ['sanction', 'amende', 'majoration'],
  'cgf': ['contribution globale fonciere', 'regime simplifie'],
  'delai': ['date limite', 'echeance', 'deadline']
};

/**
 * Normalize text for search (lowercase, remove accents, trim)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/['']/g, ' ') // Replace apostrophes with space
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Extract keywords from user query
 */
export function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ');

  // Filter stop words and short words
  const keywords = words.filter(word =>
    word.length > 2 && !FRENCH_STOP_WORDS.has(word)
  );

  // Add synonyms for known tax terms
  const expandedKeywords = new Set(keywords);
  keywords.forEach(keyword => {
    const synonyms = KEYWORD_SYNONYMS[keyword];
    if (synonyms) {
      synonyms.forEach(syn => {
        normalizeText(syn).split(' ').forEach(w => {
          if (w.length > 2) expandedKeywords.add(w);
        });
      });
    }
  });

  return Array.from(expandedKeywords);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0 to 1)
 */
function similarityScore(s1: string, s2: string): number {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

/**
 * Calculate relevance score for an FAQ entry against a query
 */
export function calculateRelevanceScore(query: string, entry: FAQEntry): number {
  const queryKeywords = extractKeywords(query);
  const normalizedQuestion = normalizeText(entry.question);
  const normalizedAnswer = normalizeText(entry.answer);
  const entryKeywords = entry.keywords.map(k => normalizeText(k));

  let score = 0;

  // Exact keyword matches in entry keywords (highest weight)
  queryKeywords.forEach(qk => {
    if (entryKeywords.includes(qk)) {
      score += 10;
    }
  });

  // Exact matches in question (high weight)
  queryKeywords.forEach(qk => {
    if (normalizedQuestion.includes(qk)) {
      score += 5;
    }
  });

  // Exact matches in answer (medium weight)
  queryKeywords.forEach(qk => {
    if (normalizedAnswer.includes(qk)) {
      score += 2;
    }
  });

  // Fuzzy matching for keywords
  queryKeywords.forEach(qk => {
    entryKeywords.forEach(ek => {
      const sim = similarityScore(qk, ek);
      if (sim > 0.7 && sim < 1) {
        score += sim * 3;
      }
    });
  });

  // Bonus for database rank if available
  if (entry.rank) {
    score += entry.rank * 5;
  }

  return score;
}

/**
 * Search FAQ entries using PostgreSQL full-text search
 */
export async function searchFAQ(query: string, maxResults: number = 5): Promise<FAQEntry[]> {
  try {
    // First, try the database search function
    const { data: dbResults, error: dbError } = await supabase
      .rpc('search_faq', {
        search_query: query,
        max_results: maxResults * 2 // Get more results for re-ranking
      });

    if (dbError) {
      console.error('Database search error:', dbError);
    }

    // If database search returned results, use them
    if (dbResults && dbResults.length > 0) {
      const entries = dbResults.map((row: any) => ({
        id: row.id,
        category_id: row.category_id,
        question: row.question,
        answer: row.answer,
        keywords: row.keywords || [],
        rank: row.rank
      }));

      // Re-rank using our scoring algorithm
      entries.sort((a: FAQEntry, b: FAQEntry) =>
        calculateRelevanceScore(query, b) - calculateRelevanceScore(query, a)
      );

      return entries.slice(0, maxResults);
    }

    // Fallback: keyword-based search
    const keywords = extractKeywords(query);

    if (keywords.length === 0) {
      return [];
    }

    // Search by keywords array overlap
    const { data: keywordResults, error: keywordError } = await supabase
      .from('faq_entries')
      .select('*')
      .eq('is_active', true)
      .or(keywords.map(k => `keywords.cs.{${k}}`).join(','))
      .limit(maxResults * 2);

    if (keywordError) {
      console.error('Keyword search error:', keywordError);
    }

    if (keywordResults && keywordResults.length > 0) {
      const entries = keywordResults.map((row: any) => ({
        id: row.id,
        category_id: row.category_id,
        question: row.question,
        answer: row.answer,
        keywords: row.keywords || []
      }));

      entries.sort((a: FAQEntry, b: FAQEntry) =>
        calculateRelevanceScore(query, b) - calculateRelevanceScore(query, a)
      );

      return entries.slice(0, maxResults);
    }

    // Last resort: ILIKE search on question
    const { data: ilikeResults, error: ilikeError } = await supabase
      .from('faq_entries')
      .select('*')
      .eq('is_active', true)
      .or(keywords.map(k => `question.ilike.%${k}%`).join(','))
      .limit(maxResults);

    if (ilikeError) {
      console.error('ILIKE search error:', ilikeError);
      return [];
    }

    return (ilikeResults || []).map((row: any) => ({
      id: row.id,
      category_id: row.category_id,
      question: row.question,
      answer: row.answer,
      keywords: row.keywords || []
    }));

  } catch (error) {
    console.error('Search FAQ error:', error);
    return [];
  }
}

/**
 * Get all FAQ categories
 */
export async function getCategories(): Promise<FAQCategory[]> {
  try {
    const { data, error } = await supabase
      .from('faq_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Get categories error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get categories error:', error);
    return [];
  }
}

/**
 * Get FAQ entries by category
 */
export async function getFAQByCategory(categoryName: string): Promise<FAQEntry[]> {
  try {
    const { data, error } = await supabase
      .from('faq_entries')
      .select(`
        *,
        faq_categories!inner(name)
      `)
      .eq('faq_categories.name', categoryName)
      .eq('is_active', true);

    if (error) {
      console.error('Get FAQ by category error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      category_id: row.category_id,
      question: row.question,
      answer: row.answer,
      keywords: row.keywords || []
    }));
  } catch (error) {
    console.error('Get FAQ by category error:', error);
    return [];
  }
}

/**
 * Increment view count for an FAQ entry
 */
export async function incrementViewCount(faqId: string): Promise<void> {
  try {
    await supabase.rpc('increment_faq_view', { faq_id: faqId });
  } catch (error) {
    console.error('Increment view count error:', error);
  }
}

/**
 * Build context string from FAQ entries for Gemini
 */
export function buildContext(entries: FAQEntry[]): string {
  if (entries.length === 0) {
    return '';
  }

  const contextParts = entries.map((entry, index) => {
    return `[FAQ ${index + 1}]
Question: ${entry.question}
Reponse: ${entry.answer}`;
  });

  return `Voici les informations pertinentes de notre base de connaissances fiscales:

${contextParts.join('\n\n---\n\n')}

Utilise ces informations pour repondre a la question de l'utilisateur de maniere precise et complete.`;
}

/**
 * Main function: Get relevant context for a user query
 */
export async function getRelevantContext(query: string): Promise<SearchResult> {
  const entries = await searchFAQ(query, 3);
  const context = buildContext(entries);
  const queryKeywords = extractKeywords(query);

  // Increment view counts for retrieved entries
  entries.forEach(entry => {
    incrementViewCount(entry.id).catch(() => {});
  });

  return {
    entries,
    context,
    queryKeywords
  };
}

/**
 * Check if a query is tax-related
 */
export function isTaxRelatedQuery(message: string): boolean {
  const TAX_KEYWORDS = [
    'taxe', 'tpt', 'impot', 'foncier', 'bailleur', 'loyer',
    'propriete', 'contribution', 'cfpb', 'cgf', 'etax',
    'declaration', 'enregistrement', 'bail', 'locataire',
    'fiscale', 'fiscal', 'payer', 'penalite', 'amende',
    'revenus fonciers', 'location', 'immobilier', 'propriétaire',
    'dgid', 'tresor', 'quittance', 'attestation'
  ];

  const normalizedMessage = normalizeText(message);

  return TAX_KEYWORDS.some(keyword =>
    normalizedMessage.includes(normalizeText(keyword))
  );
}
