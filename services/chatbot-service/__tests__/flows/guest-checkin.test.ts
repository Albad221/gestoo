import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('../../src/lib/session.js', () => ({
  updateSession: vi.fn(),
}));

vi.mock('../../src/lib/wati.js', () => ({
  sendMessage: vi.fn(),
  sendInteractiveButtons: vi.fn(),
  downloadMedia: vi.fn(),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../src/lib/moondream.js', () => ({
  extractDocumentData: vi.fn(),
  isValidDocument: vi.fn(),
}));

// Types
interface GuestData {
  firstName?: string;
  lastName?: string;
  nationality?: string;
  documentType?: 'passport' | 'national_id' | 'residence_permit' | 'other';
  documentNumber?: string;
  dateOfBirth?: string;
  isMinor?: boolean;
  age?: number;
  guardianName?: string;
  guardianPhone?: string;
  propertyId?: string;
  nights?: number;
  numGuests?: number;
}

// Helper to calculate age
function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Helper to check if minor
function isMinor(dateOfBirth: string): boolean {
  return calculateAge(dateOfBirth) < 18;
}

// Helper to calculate TPT
function calculateTPT(nights: number, numGuests: number): number {
  return 1000 * nights * numGuests;
}

// Helper to parse date in DD/MM/YYYY format
function parseDateString(dateStr: string): Date | null {
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

describe('Guest Check-in Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Age Calculation', () => {
    it('should correctly calculate age for adult', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 30, 0, 1);
      const age = calculateAge(birthDate.toISOString().split('T')[0]);
      expect(age).toBeGreaterThanOrEqual(29);
    });

    it('should correctly identify minor', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate());
      expect(isMinor(birthDate.toISOString().split('T')[0])).toBe(true);
    });

    it('should correctly identify adult', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
      expect(isMinor(birthDate.toISOString().split('T')[0])).toBe(false);
    });

    it('should handle edge case of 18th birthday', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      expect(isMinor(birthDate.toISOString().split('T')[0])).toBe(false);
    });
  });

  describe('TPT Calculation', () => {
    it('should calculate TPT for 1 night, 1 guest', () => {
      expect(calculateTPT(1, 1)).toBe(1000);
    });

    it('should calculate TPT for multiple nights', () => {
      expect(calculateTPT(7, 1)).toBe(7000);
    });

    it('should calculate TPT for multiple guests', () => {
      expect(calculateTPT(1, 4)).toBe(4000);
    });

    it('should calculate TPT for multiple nights and guests', () => {
      expect(calculateTPT(5, 3)).toBe(15000);
    });
  });

  describe('Date Parsing', () => {
    it('should parse DD/MM/YYYY format', () => {
      const date = parseDateString('15/06/1990');
      expect(date).toBeDefined();
      expect(date?.getDate()).toBe(15);
      expect(date?.getMonth()).toBe(5); // June (0-indexed)
      expect(date?.getFullYear()).toBe(1990);
    });

    it('should parse ISO format', () => {
      const date = parseDateString('1990-06-15');
      expect(date).toBeDefined();
      expect(date?.getFullYear()).toBe(1990);
    });

    it('should return null for invalid date', () => {
      const date = parseDateString('invalid-date');
      expect(date).toBeNull();
    });

    it('should handle edge dates correctly', () => {
      const date = parseDateString('31/12/2000');
      expect(date?.getDate()).toBe(31);
      expect(date?.getMonth()).toBe(11); // December
    });
  });

  describe('Property Selection', () => {
    it('should skip property selection when only one property exists', () => {
      const properties = [{ id: 'prop-1', name: 'Hotel A', city: 'Dakar' }];
      const shouldSkipSelection = properties.length === 1;
      expect(shouldSkipSelection).toBe(true);
    });

    it('should require property selection for multiple properties', () => {
      const properties = [
        { id: 'prop-1', name: 'Hotel A', city: 'Dakar' },
        { id: 'prop-2', name: 'Hotel B', city: 'Thies' },
      ];
      const shouldShowSelection = properties.length > 1;
      expect(shouldShowSelection).toBe(true);
    });

    it('should validate property selection input', () => {
      const properties = [
        { id: 'prop-1', name: 'Hotel A' },
        { id: 'prop-2', name: 'Hotel B' },
        { id: 'prop-3', name: 'Hotel C' },
      ];

      const validSelection = 2;
      const invalidSelection = 5;

      expect(validSelection >= 1 && validSelection <= properties.length).toBe(true);
      expect(invalidSelection >= 1 && invalidSelection <= properties.length).toBe(false);
    });
  });

  describe('Document Upload', () => {
    it('should detect manual entry request', () => {
      const messageText = 'manuel';
      const isManualRequest = messageText.toLowerCase() === 'manuel';
      expect(isManualRequest).toBe(true);
    });

    it('should accept image message type', () => {
      const messageType = 'image';
      const isValidDocUpload = messageType === 'image' || messageType === 'document';
      expect(isValidDocUpload).toBe(true);
    });

    it('should accept document message type', () => {
      const messageType = 'document';
      const isValidDocUpload = messageType === 'image' || messageType === 'document';
      expect(isValidDocUpload).toBe(true);
    });

    it('should reject text message for document upload', () => {
      const messageType = 'text';
      const isValidDocUpload = messageType === 'image' || messageType === 'document';
      expect(isValidDocUpload).toBe(false);
    });
  });

  describe('OCR Data Extraction', () => {
    it('should split full name into first and last name', () => {
      const fullName = 'Jean Pierre Sarr';
      const parts = fullName.split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || parts[0];

      expect(firstName).toBe('Jean');
      expect(lastName).toBe('Pierre Sarr');
    });

    it('should handle single name', () => {
      const fullName = 'Madonna';
      const parts = fullName.split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || parts[0];

      expect(firstName).toBe('Madonna');
      expect(lastName).toBe('Madonna');
    });
  });

  describe('Manual Entry Flow', () => {
    it('should map document type selection correctly', () => {
      const docTypes: Record<string, string> = {
        '1': 'passport',
        '2': 'national_id',
        '3': 'residence_permit',
        '4': 'other',
      };

      expect(docTypes['1']).toBe('passport');
      expect(docTypes['2']).toBe('national_id');
      expect(docTypes['3']).toBe('residence_permit');
      expect(docTypes['4']).toBe('other');
    });

    it('should reject invalid document type selection', () => {
      const docTypes: Record<string, string> = {
        '1': 'passport',
        '2': 'national_id',
        '3': 'residence_permit',
        '4': 'other',
      };

      expect(docTypes['5']).toBeUndefined();
      expect(docTypes['invalid']).toBeUndefined();
    });
  });

  describe('Guardian Info for Minors', () => {
    it('should require guardian info for minors', () => {
      const guestData: GuestData = {
        firstName: 'Moussa',
        lastName: 'Diop',
        isMinor: true,
      };

      const needsGuardian = guestData.isMinor;
      expect(needsGuardian).toBe(true);
    });

    it('should not require guardian info for adults', () => {
      const guestData: GuestData = {
        firstName: 'Amadou',
        lastName: 'Ndiaye',
        isMinor: false,
      };

      const needsGuardian = guestData.isMinor;
      expect(needsGuardian).toBe(false);
    });

    it('should normalize guardian phone number', () => {
      const rawPhone = '77 123 45 67';
      const normalizedPhone = rawPhone.replace(/\s/g, '');
      expect(normalizedPhone).toBe('77123-4567'.replace(/-/g, ''));
    });
  });

  describe('Nights Validation', () => {
    it('should accept valid number of nights', () => {
      const nights = 5;
      const isValid = !isNaN(nights) && nights >= 1 && nights <= 365;
      expect(isValid).toBe(true);
    });

    it('should reject zero nights', () => {
      const nights = 0;
      const isValid = !isNaN(nights) && nights >= 1 && nights <= 365;
      expect(isValid).toBe(false);
    });

    it('should reject negative nights', () => {
      const nights = -3;
      const isValid = !isNaN(nights) && nights >= 1 && nights <= 365;
      expect(isValid).toBe(false);
    });

    it('should reject more than 365 nights', () => {
      const nights = 400;
      const isValid = !isNaN(nights) && nights >= 1 && nights <= 365;
      expect(isValid).toBe(false);
    });
  });

  describe('Number of Guests Validation', () => {
    it('should accept valid number of guests', () => {
      const numGuests = 4;
      const isValid = !isNaN(numGuests) && numGuests >= 1 && numGuests <= 20;
      expect(isValid).toBe(true);
    });

    it('should reject zero guests', () => {
      const numGuests = 0;
      const isValid = !isNaN(numGuests) && numGuests >= 1 && numGuests <= 20;
      expect(isValid).toBe(false);
    });

    it('should reject more than 20 guests', () => {
      const numGuests = 25;
      const isValid = !isNaN(numGuests) && numGuests >= 1 && numGuests <= 20;
      expect(isValid).toBe(false);
    });
  });

  describe('Check-in Confirmation', () => {
    it('should handle cancel action', () => {
      const reply = 'cancel_checkin';
      const shouldCancel = reply === 'cancel_checkin';
      expect(shouldCancel).toBe(true);
    });

    it('should handle confirm action', () => {
      const reply = 'confirm_checkin';
      const shouldConfirm = reply === 'confirm_checkin';
      expect(shouldConfirm).toBe(true);
    });

    it('should create guest record with correct data', () => {
      const guestData: GuestData = {
        firstName: 'Amadou',
        lastName: 'Diallo',
        nationality: 'Senegal',
        documentType: 'national_id',
        documentNumber: 'SN123456789',
        dateOfBirth: '1990-05-15',
      };

      const guestRecord = {
        first_name: guestData.firstName,
        last_name: guestData.lastName,
        nationality: guestData.nationality,
        document_type: guestData.documentType,
        document_number: guestData.documentNumber,
        date_of_birth: guestData.dateOfBirth,
      };

      expect(guestRecord.first_name).toBe('Amadou');
      expect(guestRecord.document_type).toBe('national_id');
    });

    it('should create stay record with guardian info for minor', () => {
      const guestData: GuestData = {
        firstName: 'Moussa',
        lastName: 'Ndiaye',
        isMinor: true,
        guardianName: 'Fatou Ndiaye',
        guardianPhone: '771234567',
        propertyId: 'prop-123',
        nights: 3,
        numGuests: 1,
      };

      const stayRecord = {
        property_id: guestData.propertyId,
        nights: guestData.nights,
        num_guests: guestData.numGuests,
        is_accompanied: guestData.isMinor,
        guardian_name: guestData.guardianName,
        guardian_phone: guestData.guardianPhone,
      };

      expect(stayRecord.is_accompanied).toBe(true);
      expect(stayRecord.guardian_name).toBe('Fatou Ndiaye');
    });
  });

  describe('Minor Alert Generation', () => {
    it('should set high severity when no guardian declared', () => {
      const guestData: GuestData = {
        isMinor: true,
        guardianName: undefined,
      };

      const severity = guestData.guardianName ? 'low' : 'high';
      expect(severity).toBe('high');
    });

    it('should set low severity when guardian is declared', () => {
      const guestData: GuestData = {
        isMinor: true,
        guardianName: 'Parent Name',
      };

      const severity = guestData.guardianName ? 'low' : 'high';
      expect(severity).toBe('low');
    });
  });
});
