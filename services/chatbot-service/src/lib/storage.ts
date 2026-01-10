/**
 * Document Storage Helper
 *
 * Handles uploading documents to Supabase Storage
 * and creating records in property_documents table.
 */

import { supabase } from './supabase.js';
import type { ExtractedDocument } from './ocr.js';

export type DocumentType =
  | 'cni'
  | 'passport'
  | 'titre_propriete'
  | 'bail'
  | 'property_photo'
  | 'other';

interface UploadDocumentParams {
  buffer: Buffer;
  mimeType: string;
  documentType: DocumentType;
  landlordId?: string;
  propertyId?: string;
  extractedData?: ExtractedDocument;
  fileName?: string;
}

interface UploadResult {
  success: boolean;
  documentId?: string;
  fileUrl?: string;
  error?: string;
}

const BUCKET_NAME = 'documents';

/**
 * Map OCR category to document type
 */
export function mapCategoryToDocType(category: string): DocumentType {
  switch (category) {
    case 'identity':
      return 'cni'; // Could be cni or passport, default to cni
    case 'property_photo':
      return 'property_photo';
    case 'property_deed':
      return 'titre_propriete';
    default:
      return 'other';
  }
}

/**
 * Upload document to Supabase Storage and create database record
 */
export async function uploadDocument(params: UploadDocumentParams): Promise<UploadResult> {
  const {
    buffer,
    mimeType,
    documentType,
    landlordId,
    propertyId,
    extractedData,
    fileName,
  } = params;

  try {
    // Generate unique file name
    const timestamp = Date.now();
    const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : 'jpg';
    const folder = landlordId || 'anonymous';
    const storagePath = `${folder}/${documentType}_${timestamp}.${ext}`;

    console.log('[STORAGE] Uploading document:', storagePath);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[STORAGE] Upload error:', uploadError);
      // If bucket doesn't exist, try to continue without storage
      if (uploadError.message?.includes('Bucket not found')) {
        console.warn('[STORAGE] Bucket not found, skipping storage upload');
        return { success: false, error: 'Storage bucket not configured' };
      }
      return { success: false, error: uploadError.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const fileUrl = urlData?.publicUrl || storagePath;

    console.log('[STORAGE] File uploaded:', fileUrl);

    // Create database record
    const { data: docRecord, error: dbError } = await supabase
      .from('property_documents')
      .insert({
        property_id: propertyId || null,
        landlord_id: landlordId || null,
        document_type: documentType,
        file_url: fileUrl,
        file_name: fileName || `${documentType}_${timestamp}.${ext}`,
        file_size: buffer.length,
        mime_type: mimeType,
        extracted_data: extractedData || null,
        ocr_confidence: extractedData?.confidence || null,
        uploaded_via: 'whatsapp',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[STORAGE] Database error:', dbError);
      // Document uploaded but DB record failed
      return {
        success: true,
        fileUrl,
        error: `Uploaded but DB record failed: ${dbError.message}`,
      };
    }

    console.log('[STORAGE] Document record created:', docRecord.id);

    return {
      success: true,
      documentId: docRecord.id,
      fileUrl,
    };
  } catch (error) {
    console.error('[STORAGE] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Link a document to a property (for when property is created after document upload)
 */
export async function linkDocumentToProperty(
  documentId: string,
  propertyId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('property_documents')
      .update({ property_id: propertyId })
      .eq('id', documentId);

    if (error) {
      console.error('[STORAGE] Error linking document:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[STORAGE] Unexpected error linking document:', error);
    return false;
  }
}

/**
 * Get documents for a property
 */
export async function getPropertyDocuments(propertyId: string) {
  const { data, error } = await supabase
    .from('property_documents')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[STORAGE] Error fetching documents:', error);
    return [];
  }

  return data || [];
}

/**
 * Get documents for a landlord (pending property assignment)
 */
export async function getLandlordPendingDocuments(landlordId: string) {
  const { data, error } = await supabase
    .from('property_documents')
    .select('*')
    .eq('landlord_id', landlordId)
    .is('property_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[STORAGE] Error fetching pending documents:', error);
    return [];
  }

  return data || [];
}
