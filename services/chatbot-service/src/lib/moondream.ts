/**
 * Moondream Vision AI Client
 * Uses custom Modal endpoint for document analysis
 *
 * Endpoint: https://andromeda--moondream-vision-app-factory.modal.run
 *
 * Features:
 * - ID document scanning (passports, national IDs, residence permits)
 * - OCR text extraction
 * - Object detection
 * - Image captioning
 *
 * No API key required - uses Modal serverless deployment
 */

// ============================================================================
// Configuration
// ============================================================================

const MOONDREAM_ENDPOINT = 'https://andromeda--moondream-vision-app-factory.modal.run';

// ============================================================================
// Type Definitions
// ============================================================================

export type DocumentType = 'passport' | 'national_id' | 'residence_permit' | 'drivers_license' | 'other';

export interface ExtractedDocumentData {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  documentNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  expiryDate?: string;
  issueDate?: string;
  gender?: string;
  placeOfBirth?: string;
  issuingCountry?: string;
  issuingAuthority?: string;
  address?: string;
  mrz?: string;
  photoDetected?: boolean;
}

export interface DocumentOCRResult {
  success: boolean;
  documentType?: DocumentType;
  extractedData?: ExtractedDocumentData;
  confidence: number;
  rawText?: string;
  error?: string;
  processingTimeMs?: number;
}

export interface DocumentValidationResult {
  isValid: boolean;
  confidence: number;
  documentType?: DocumentType;
  issues: DocumentIssue[];
  suggestions?: string[];
}

export interface DocumentIssue {
  type: 'quality' | 'completeness' | 'authenticity' | 'expiry' | 'format';
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export interface GuestPhotoInfo {
  facesDetected: number;
  estimatedAge?: number;
  isLikelyMinor: boolean;
  gender?: string;
  description?: string;
  confidence: number;
}

export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface DetectedObject {
  label: string;
  boundingBox: BoundingBox;
  count?: number;
}

export interface DetectionResponse {
  objects: BoundingBox[];
  count: number;
}

export interface CaptionResponse {
  caption: string;
}

export interface OCRResponse {
  text: string;
}

// ============================================================================
// Moondream Client Class
// ============================================================================

export class MoondreamClient {
  private endpoint: string;

  constructor(config?: { endpoint?: string }) {
    this.endpoint = config?.endpoint || MOONDREAM_ENDPOINT;
  }

  // ==========================================================================
  // Core API Methods (Modal endpoint uses multipart form data)
  // ==========================================================================

  /**
   * Generate a caption for an image
   */
  async caption(image: Buffer, length: 'short' | 'normal' | 'long' = 'normal'): Promise<string> {
    const formData = new FormData();
    formData.append('image', new Blob([image]), 'image.jpg');
    formData.append('length', length);

    const response = await fetch(`${this.endpoint}/caption/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Moondream caption error: ${response.status}`);
    }

    const result: CaptionResponse = await response.json();
    return result.caption;
  }

  /**
   * Extract text from an image using OCR
   */
  async ocr(image: Buffer, prompt?: string): Promise<string> {
    const formData = new FormData();
    formData.append('image', new Blob([image]), 'image.jpg');
    if (prompt) {
      formData.append('prompt', prompt);
    }

    const response = await fetch(`${this.endpoint}/ocr/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Moondream OCR error: ${response.status}`);
    }

    const result: OCRResponse = await response.json();
    return result.text;
  }

  /**
   * Detect objects in an image
   */
  async detect(image: Buffer, objectName: string): Promise<DetectedObject[]> {
    const formData = new FormData();
    formData.append('image', new Blob([image]), 'image.jpg');
    formData.append('object_name', objectName);

    const response = await fetch(`${this.endpoint}/detect/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Moondream detect error: ${response.status}`);
    }

    const result: DetectionResponse = await response.json();
    return result.objects.map(box => ({
      label: objectName,
      boundingBox: box,
      count: result.count,
    }));
  }

  /**
   * Check health of the endpoint
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/health/`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Document Scanning Methods
  // ==========================================================================

  /**
   * Extract data from an ID document (passport, national ID, etc.)
   */
  async extractDocumentData(image: Buffer): Promise<DocumentOCRResult> {
    const startTime = Date.now();

    try {
      // Step 1: Get raw OCR text
      const rawText = await this.ocr(image,
        'Extract all text from this identity document including names, numbers, dates, nationality. Return structured data.'
      );

      console.log('[moondream] OCR raw text:', rawText.substring(0, 200));

      // Step 2: Identify document type from caption
      const caption = await this.caption(image, 'short');
      const documentType = this.parseDocumentType(caption);

      // Step 3: Parse extracted data
      const extractedData = this.parseDocumentText(rawText, documentType);

      // Step 4: Detect face for photo verification
      try {
        const faces = await this.detect(image, 'face');
        extractedData.photoDetected = faces.length > 0;
      } catch {
        // Photo detection is optional
      }

      // Calculate confidence
      const fieldCount = Object.values(extractedData).filter(v =>
        v !== undefined && v !== null && v !== ''
      ).length;
      const confidence = Math.min(0.95, 0.3 + (fieldCount * 0.08));

      return {
        success: fieldCount > 2,
        documentType,
        extractedData,
        confidence,
        rawText,
        processingTimeMs: Date.now() - startTime,
      };

    } catch (error) {
      console.error('[moondream] Error extracting document:', error);
      return {
        success: false,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate document quality and authenticity
   */
  async validateDocument(image: Buffer): Promise<DocumentValidationResult> {
    const issues: DocumentIssue[] = [];

    try {
      // Get document caption for analysis
      const caption = await this.caption(image, 'long');
      const documentType = this.parseDocumentType(caption);

      // Check for quality issues in description
      const lowerCaption = caption.toLowerCase();

      if (lowerCaption.includes('blur') || lowerCaption.includes('unclear')) {
        issues.push({
          type: 'quality',
          severity: 'warning',
          message: 'Image may be blurry or unclear',
        });
      }

      if (lowerCaption.includes('partial') || lowerCaption.includes('cropped')) {
        issues.push({
          type: 'completeness',
          severity: 'error',
          message: 'Document appears to be partially visible',
        });
      }

      // Try to extract data and check for completeness
      const extraction = await this.extractDocumentData(image);

      if (!extraction.extractedData?.documentNumber) {
        issues.push({
          type: 'completeness',
          severity: 'warning',
          message: 'Could not extract document number',
        });
      }

      if (!extraction.extractedData?.lastName && !extraction.extractedData?.fullName) {
        issues.push({
          type: 'completeness',
          severity: 'warning',
          message: 'Could not extract name from document',
        });
      }

      // Check expiration
      if (extraction.extractedData?.expiryDate) {
        const expiry = new Date(extraction.extractedData.expiryDate);
        if (expiry < new Date()) {
          issues.push({
            type: 'expiry',
            severity: 'error',
            message: `Document expired on ${extraction.extractedData.expiryDate}`,
          });
        }
      }

      const hasErrors = issues.some(i => i.severity === 'error');

      return {
        isValid: !hasErrors,
        confidence: extraction.confidence,
        documentType,
        issues,
        suggestions: hasErrors ? [
          'Ensure document is fully visible in frame',
          'Take photo in good lighting',
          'Avoid glare and reflections',
          'Hold camera steady to avoid blur',
        ] : undefined,
      };

    } catch (error) {
      return {
        isValid: false,
        confidence: 0,
        issues: [{
          type: 'quality',
          severity: 'error',
          message: 'Could not analyze document image',
        }],
      };
    }
  }

  /**
   * Quick check if image contains a valid document
   */
  async isValidDocument(image: Buffer): Promise<{
    isValid: boolean;
    confidence: number;
    reason?: string;
  }> {
    try {
      const caption = await this.caption(image, 'short');
      const isDocument = /passport|id card|identity|document|license|permit|cni|carte/i.test(caption);

      return {
        isValid: isDocument,
        confidence: isDocument ? 0.8 : 0.3,
        reason: caption,
      };
    } catch {
      return {
        isValid: false,
        confidence: 0,
        reason: 'Could not analyze image',
      };
    }
  }

  // ==========================================================================
  // Guest Information Methods
  // ==========================================================================

  /**
   * Extract guest information from photo
   */
  async extractGuestInfo(image: Buffer): Promise<GuestPhotoInfo> {
    try {
      const faces = await this.detect(image, 'face');

      if (faces.length === 0) {
        return {
          facesDetected: 0,
          isLikelyMinor: false,
          confidence: 0.8,
          description: 'No faces detected',
        };
      }

      // Get description for age/gender estimation
      const caption = await this.caption(image, 'normal');

      // Parse age estimate from caption
      const ageMatch = caption.match(/(\d{1,2})[\s-]*(year|ans|old)/i);
      const estimatedAge = ageMatch ? parseInt(ageMatch[1]) : undefined;

      // Check for gender indicators
      let gender: string | undefined;
      if (/(man|male|homme|garcon|boy)/i.test(caption)) gender = 'male';
      if (/(woman|female|femme|fille|girl)/i.test(caption)) gender = 'female';

      // Check for minor indicators
      const isLikelyMinor =
        (estimatedAge !== undefined && estimatedAge < 18) ||
        /child|kid|enfant|mineur|young|jeune|teen/i.test(caption);

      return {
        facesDetected: faces.length,
        estimatedAge,
        isLikelyMinor,
        gender,
        description: caption,
        confidence: 0.7,
      };

    } catch (error) {
      return {
        facesDetected: 0,
        isLikelyMinor: false,
        confidence: 0,
      };
    }
  }

  /**
   * Check if person appears to be a minor
   */
  async checkIfMinor(image: Buffer): Promise<{
    isLikelyMinor: boolean;
    estimatedAge?: number;
    confidence: number;
  }> {
    const guestInfo = await this.extractGuestInfo(image);
    return {
      isLikelyMinor: guestInfo.isLikelyMinor,
      estimatedAge: guestInfo.estimatedAge,
      confidence: guestInfo.confidence,
    };
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private parseDocumentType(text: string): DocumentType {
    const lower = text.toLowerCase();
    if (lower.includes('passport') || lower.includes('passeport')) return 'passport';
    if (lower.includes('national') || lower.includes('cni') || lower.includes('identity card') || lower.includes('carte d\'identit')) return 'national_id';
    if (lower.includes('residence') || lower.includes('permit') || lower.includes('sejour')) return 'residence_permit';
    if (lower.includes('driver') || lower.includes('license') || lower.includes('permis')) return 'drivers_license';
    return 'other';
  }

  private parseDocumentText(rawText: string, documentType: DocumentType): ExtractedDocumentData {
    const data: ExtractedDocumentData = {};
    const text = rawText.toUpperCase();
    const lines = rawText.split('
').map(l => l.trim()).filter(Boolean);

    // Document number patterns
    const docNumPatterns = [
      /(?:PASSPORT|DOCUMENT|NO|NUM[EÉ]RO|ID)[:\s#]*([A-Z0-9]{6,15})/i,
      /([A-Z]{1,2}\d{6,9})/,
      /(\d{2}[A-Z]{2}\d{5})/,
    ];
    for (const pattern of docNumPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        data.documentNumber = match[1];
        break;
      }
    }

    // Name patterns
    const surnameMatch = rawText.match(/(?:SURNAME|NOM|LAST\s*NAME|FAMILY\s*NAME)[:\s]*([A-Za-zÀ-ÿ\s\-']+)/i);
    if (surnameMatch) data.lastName = this.cleanName(surnameMatch[1]);

    const firstNameMatch = rawText.match(/(?:GIVEN|FIRST|PR[EÉ]NOM|FORENAME)[:\s]*([A-Za-zÀ-ÿ\s\-']+)/i);
    if (firstNameMatch) data.firstName = this.cleanName(firstNameMatch[1]);

    // Date patterns (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)
    const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
    const dates = rawText.match(datePattern) || [];

    // Try to identify which date is which based on context
    if (rawText.match(/(?:BIRTH|NAISSANCE|DOB|N[EÉ]\(E\))[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i)) {
      const m = rawText.match(/(?:BIRTH|NAISSANCE|DOB|N[EÉ]\(E\))[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
      if (m) data.dateOfBirth = this.formatDate(m[1]);
    }

    if (rawText.match(/(?:EXPIR|VALID|VALIDIT[EÉ])[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i)) {
      const m = rawText.match(/(?:EXPIR|VALID|VALIDIT[EÉ])[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
      if (m) data.expiryDate = this.formatDate(m[1]);
    }

    // Nationality
    const nationalityMatch = rawText.match(/(?:NATIONALITY|NATIONALIT[EÉ]|CITIZEN)[:\s]*([A-Za-z\s]+)/i);
    if (nationalityMatch) data.nationality = this.cleanName(nationalityMatch[1]);

    // Gender
    if (/(MALE|HOMME|MASCULIN|M)/.test(text)) data.gender = 'M';
    if (/(FEMALE|FEMME|F[EÉ]MININ|F)/.test(text)) data.gender = 'F';

    // Place of birth
    const pobMatch = rawText.match(/(?:PLACE OF BIRTH|LIEU DE NAISSANCE|BIRTHPLACE)[:\s]*([A-Za-zÀ-ÿ\s\-']+)/i);
    if (pobMatch) data.placeOfBirth = this.cleanName(pobMatch[1]);

    // MRZ (Machine Readable Zone) - bottom of passport
    const mrzMatch = rawText.match(/([A-Z<]{2}[A-Z<]{3}[A-Z<]{39,44})/);
    if (mrzMatch) data.mrz = mrzMatch[0];

    return data;
  }

  private cleanName(name: string): string {
    return name
      .replace(/[<>\/\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private formatDate(dateStr: string): string | undefined {
    if (!dateStr) return undefined;

    const match = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (!match) return dateStr;

    let [, day, month, year] = match;

    // Handle 2-digit year
    if (year.length === 2) {
      const y = parseInt(year);
      year = y > 50 ? `19${year}` : `20${year}`;
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
}

// ============================================================================
// Singleton Instance & Convenience Functions
// ============================================================================

let defaultClient: MoondreamClient | null = null;

function getDefaultClient(): MoondreamClient {
  if (!defaultClient) {
    defaultClient = new MoondreamClient();
  }
  return defaultClient;
}

/**
 * Analyze an image using Moondream Vision API
 */
export async function analyzeImage(imageBuffer: Buffer, prompt: string): Promise<string> {
  return getDefaultClient().ocr(imageBuffer, prompt);
}

/**
 * Extract text from an ID document
 */
export async function extractDocumentData(imageBuffer: Buffer): Promise<DocumentOCRResult> {
  return getDefaultClient().extractDocumentData(imageBuffer);
}

/**
 * Check if image contains a valid document
 */
export async function isValidDocument(imageBuffer: Buffer): Promise<{
  isValid: boolean;
  confidence: number;
  reason?: string;
}> {
  return getDefaultClient().isValidDocument(imageBuffer);
}

/**
 * Validate document authenticity and quality
 */
export async function validateDocument(imageBuffer: Buffer): Promise<DocumentValidationResult> {
  return getDefaultClient().validateDocument(imageBuffer);
}

/**
 * Check if person appears to be a minor
 */
export async function checkIfMinor(imageBuffer: Buffer): Promise<{
  isLikelyMinor: boolean;
  estimatedAge?: number;
  confidence: number;
}> {
  return getDefaultClient().checkIfMinor(imageBuffer);
}

/**
 * Extract guest information from photo
 */
export async function extractGuestInfo(imageBuffer: Buffer): Promise<GuestPhotoInfo> {
  return getDefaultClient().extractGuestInfo(imageBuffer);
}

export { MoondreamClient as default };
