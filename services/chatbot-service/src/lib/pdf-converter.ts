/**
 * PDF to Image Converter
 *
 * Converts PDF documents to images for OCR processing.
 * Uses pdf-parse to extract text directly when possible,
 * or converts to image for GPT-4 Vision analysis.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse');

interface PDFInfo {
  numPages: number;
  text: string;
  metadata: Record<string, unknown>;
}

/**
 * Extract text from PDF buffer
 * Returns text content if extractable, otherwise null
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFInfo | null> {
  try {
    const data = await pdf(pdfBuffer);

    return {
      numPages: data.numpages,
      text: data.text,
      metadata: data.metadata || {},
    };
  } catch (error) {
    console.error('[PDF] Error extracting text:', error);
    return null;
  }
}

/**
 * Check if buffer is a PDF file
 */
export function isPDF(buffer: Buffer): boolean {
  // PDF files start with %PDF-
  return buffer.length > 4 &&
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46;   // F
}

/**
 * Format PDF text for AI analysis
 */
export function formatPDFForAnalysis(pdfInfo: PDFInfo): string {
  const lines = [
    `[Document PDF reçu - ${pdfInfo.numPages} page(s)]`,
    '',
    'Contenu extrait:',
    pdfInfo.text.substring(0, 3000), // Limit text to avoid context overflow
  ];

  if (pdfInfo.text.length > 3000) {
    lines.push('... (texte tronqué)');
  }

  return lines.join('\n');
}
