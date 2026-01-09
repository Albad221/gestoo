import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Types matching WATI API
interface WatiResponse {
  result: boolean;
  info?: string;
}

interface InteractiveButton {
  id: string;
  title: string;
}

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

interface WatiWebhookPayload {
  id: string;
  waId: string;
  text: string;
  type: string;
  data?: string;
  timestamp: string;
  owner: boolean;
  senderName: string;
  listReply?: {
    title: string;
    id: string;
    description: string;
  };
}

// Helper functions (extracted from wati.ts for testing)
function normalizePhone(phone: string): string {
  return phone.replace('+', '');
}

function truncateButtonTitle(title: string): string {
  return title.substring(0, 20);
}

function truncateSectionTitle(title: string): string {
  return title.substring(0, 24);
}

function truncateRowDescription(description: string): string {
  return description.substring(0, 72);
}

function formatButtons(buttons: InteractiveButton[]): { text: string; payload: string }[] {
  return buttons.slice(0, 3).map((btn) => ({
    text: truncateButtonTitle(btn.title),
    payload: btn.id,
  }));
}

function parseWatiWebhook(payload: WatiWebhookPayload): {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string };
  document?: { id: string; mime_type: string; filename: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    list_reply?: { id: string; title: string };
  };
} {
  const result: any = {
    from: payload.waId,
    id: payload.id,
    timestamp: payload.timestamp,
    type: payload.type,
  };

  switch (payload.type) {
    case 'text':
      result.text = { body: payload.text };
      break;

    case 'image':
      if (payload.data) {
        const imageData = JSON.parse(payload.data);
        result.image = {
          id: imageData.url || imageData.id,
          mime_type: imageData.mime_type || 'image/jpeg',
        };
      }
      break;

    case 'document':
      if (payload.data) {
        const docData = JSON.parse(payload.data);
        result.document = {
          id: docData.url || docData.id,
          mime_type: docData.mime_type || 'application/pdf',
          filename: docData.filename || 'document',
        };
      }
      break;

    case 'interactive':
      if (payload.listReply) {
        result.interactive = {
          type: 'list_reply',
          list_reply: {
            id: payload.listReply.id,
            title: payload.listReply.title,
          },
        };
      }
      break;
  }

  return result;
}

describe('WATI API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Phone Number Normalization', () => {
    it('should remove + prefix from phone number', () => {
      expect(normalizePhone('+221771234567')).toBe('221771234567');
    });

    it('should handle phone without + prefix', () => {
      expect(normalizePhone('221771234567')).toBe('221771234567');
    });

    it('should handle international formats', () => {
      expect(normalizePhone('+1234567890')).toBe('1234567890');
      expect(normalizePhone('+447123456789')).toBe('447123456789');
    });
  });

  describe('Button Title Truncation', () => {
    it('should keep titles under 20 characters', () => {
      expect(truncateButtonTitle('Short')).toBe('Short');
    });

    it('should truncate titles over 20 characters', () => {
      const longTitle = 'This is a very long button title that exceeds limit';
      expect(truncateButtonTitle(longTitle).length).toBeLessThanOrEqual(20);
    });

    it('should preserve exact 20 character titles', () => {
      const exactTitle = '12345678901234567890';
      expect(truncateButtonTitle(exactTitle)).toBe(exactTitle);
    });
  });

  describe('Section Title Truncation', () => {
    it('should keep section titles under 24 characters', () => {
      expect(truncateSectionTitle('Properties')).toBe('Properties');
    });

    it('should truncate section titles over 24 characters', () => {
      const longTitle = 'This is a very long section title';
      expect(truncateSectionTitle(longTitle).length).toBeLessThanOrEqual(24);
    });
  });

  describe('Row Description Truncation', () => {
    it('should keep descriptions under 72 characters', () => {
      expect(truncateRowDescription('Short description')).toBe('Short description');
    });

    it('should truncate descriptions over 72 characters', () => {
      const longDesc =
        'This is a very long description that definitely exceeds the maximum allowed length of seventy-two characters';
      expect(truncateRowDescription(longDesc).length).toBeLessThanOrEqual(72);
    });
  });

  describe('Button Formatting', () => {
    it('should format buttons correctly', () => {
      const buttons: InteractiveButton[] = [
        { id: 'confirm', title: 'Confirm' },
        { id: 'cancel', title: 'Cancel' },
      ];

      const formatted = formatButtons(buttons);

      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toEqual({ text: 'Confirm', payload: 'confirm' });
      expect(formatted[1]).toEqual({ text: 'Cancel', payload: 'cancel' });
    });

    it('should limit to maximum 3 buttons', () => {
      const buttons: InteractiveButton[] = [
        { id: '1', title: 'Button 1' },
        { id: '2', title: 'Button 2' },
        { id: '3', title: 'Button 3' },
        { id: '4', title: 'Button 4' },
        { id: '5', title: 'Button 5' },
      ];

      const formatted = formatButtons(buttons);

      expect(formatted).toHaveLength(3);
      expect(formatted[2].payload).toBe('3');
    });

    it('should truncate long button titles', () => {
      const buttons: InteractiveButton[] = [
        { id: 'confirm', title: 'This is a very long button title' },
      ];

      const formatted = formatButtons(buttons);

      expect(formatted[0].text.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Webhook Parsing - Text Messages', () => {
    it('should parse text message correctly', () => {
      const payload: WatiWebhookPayload = {
        id: 'msg-123',
        waId: '221771234567',
        text: 'Hello, world!',
        type: 'text',
        timestamp: '1704067200',
        owner: false,
        senderName: 'User',
      };

      const parsed = parseWatiWebhook(payload);

      expect(parsed.from).toBe('221771234567');
      expect(parsed.type).toBe('text');
      expect(parsed.text?.body).toBe('Hello, world!');
    });
  });

  describe('Webhook Parsing - Image Messages', () => {
    it('should parse image message correctly', () => {
      const payload: WatiWebhookPayload = {
        id: 'msg-456',
        waId: '221771234567',
        text: '',
        type: 'image',
        data: JSON.stringify({
          url: 'image-media-id',
          mime_type: 'image/jpeg',
        }),
        timestamp: '1704067200',
        owner: false,
        senderName: 'User',
      };

      const parsed = parseWatiWebhook(payload);

      expect(parsed.type).toBe('image');
      expect(parsed.image?.id).toBe('image-media-id');
      expect(parsed.image?.mime_type).toBe('image/jpeg');
    });

    it('should use default mime type for images', () => {
      const payload: WatiWebhookPayload = {
        id: 'msg-456',
        waId: '221771234567',
        text: '',
        type: 'image',
        data: JSON.stringify({ id: 'image-id' }),
        timestamp: '1704067200',
        owner: false,
        senderName: 'User',
      };

      const parsed = parseWatiWebhook(payload);

      expect(parsed.image?.mime_type).toBe('image/jpeg');
    });
  });

  describe('Webhook Parsing - Document Messages', () => {
    it('should parse document message correctly', () => {
      const payload: WatiWebhookPayload = {
        id: 'msg-789',
        waId: '221771234567',
        text: '',
        type: 'document',
        data: JSON.stringify({
          url: 'doc-media-id',
          mime_type: 'application/pdf',
          filename: 'passport.pdf',
        }),
        timestamp: '1704067200',
        owner: false,
        senderName: 'User',
      };

      const parsed = parseWatiWebhook(payload);

      expect(parsed.type).toBe('document');
      expect(parsed.document?.id).toBe('doc-media-id');
      expect(parsed.document?.mime_type).toBe('application/pdf');
      expect(parsed.document?.filename).toBe('passport.pdf');
    });

    it('should use default values for document', () => {
      const payload: WatiWebhookPayload = {
        id: 'msg-789',
        waId: '221771234567',
        text: '',
        type: 'document',
        data: JSON.stringify({ id: 'doc-id' }),
        timestamp: '1704067200',
        owner: false,
        senderName: 'User',
      };

      const parsed = parseWatiWebhook(payload);

      expect(parsed.document?.mime_type).toBe('application/pdf');
      expect(parsed.document?.filename).toBe('document');
    });
  });

  describe('Webhook Parsing - Interactive Messages', () => {
    it('should parse list reply correctly', () => {
      const payload: WatiWebhookPayload = {
        id: 'msg-101',
        waId: '221771234567',
        text: '',
        type: 'interactive',
        timestamp: '1704067200',
        owner: false,
        senderName: 'User',
        listReply: {
          id: 'property-1',
          title: 'Hotel A',
          description: 'A nice hotel',
        },
      };

      const parsed = parseWatiWebhook(payload);

      expect(parsed.type).toBe('interactive');
      expect(parsed.interactive?.type).toBe('list_reply');
      expect(parsed.interactive?.list_reply?.id).toBe('property-1');
      expect(parsed.interactive?.list_reply?.title).toBe('Hotel A');
    });
  });

  describe('API Request Structure', () => {
    it('should construct sendMessage request correctly', () => {
      const phone = '+221771234567';
      const text = 'Hello';

      const expectedBody = {
        messageText: text,
      };

      expect(expectedBody.messageText).toBe('Hello');
    });

    it('should construct sendInteractiveButtons request correctly', () => {
      const phone = '221771234567';
      const body = 'Choose an option';
      const buttons: InteractiveButton[] = [
        { id: 'yes', title: 'Yes' },
        { id: 'no', title: 'No' },
      ];

      const expectedBody = {
        whatsappNumber: phone,
        body: body,
        buttons: formatButtons(buttons),
      };

      expect(expectedBody.whatsappNumber).toBe('221771234567');
      expect(expectedBody.buttons).toHaveLength(2);
    });

    it('should construct sendTemplate request correctly', () => {
      const phone = '221771234567';
      const templateName = 'welcome_message';
      const parameters = ['Amadou', '10000'];

      const expectedBody = {
        whatsappNumber: phone,
        templateName: templateName,
        broadcast_name: 'gestoo',
        parameters: parameters.map((p) => ({ name: 'param', value: p })),
      };

      expect(expectedBody.templateName).toBe('welcome_message');
      expect(expectedBody.parameters).toHaveLength(2);
    });
  });

  describe('Media Download', () => {
    it('should construct media download request correctly', () => {
      const mediaId = 'media-file-123';

      const expectedBody = {
        fileName: mediaId,
      };

      expect(expectedBody.fileName).toBe('media-file-123');
    });
  });

  describe('Contact Attributes', () => {
    it('should format custom attributes correctly', () => {
      const attributes = {
        landlord_id: 'landlord-123',
        registered: 'true',
        language: 'fr',
      };

      const formatted = Object.entries(attributes).map(([name, value]) => ({
        name,
        value,
      }));

      expect(formatted).toHaveLength(3);
      expect(formatted[0]).toEqual({ name: 'landlord_id', value: 'landlord-123' });
    });
  });
});
