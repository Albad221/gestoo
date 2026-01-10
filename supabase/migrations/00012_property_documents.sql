-- Property Documents Storage
-- Stores documents submitted for homologation requests

-- Create enum for document types
CREATE TYPE document_type AS ENUM (
    'cni',           -- Carte Nationale d'Identité
    'passport',      -- Passeport
    'titre_propriete', -- Titre de propriété
    'bail',          -- Contrat de bail
    'property_photo', -- Photo du bien
    'other'          -- Autre document
);

-- Create documents table
CREATE TABLE IF NOT EXISTS property_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    landlord_id UUID REFERENCES landlords(id) ON DELETE CASCADE,

    -- Document info
    document_type document_type NOT NULL DEFAULT 'other',
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,

    -- OCR extracted data (JSON)
    extracted_data JSONB,
    ocr_confidence INTEGER,

    -- Metadata
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_via TEXT DEFAULT 'whatsapp', -- whatsapp, web, api

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_property_documents_property ON property_documents(property_id);
CREATE INDEX idx_property_documents_landlord ON property_documents(landlord_id);
CREATE INDEX idx_property_documents_type ON property_documents(document_type);

-- RLS
ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role full access" ON property_documents
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can view documents
CREATE POLICY "Authenticated users can view documents" ON property_documents
    FOR SELECT USING (auth.role() = 'authenticated');

-- Update trigger
CREATE TRIGGER update_property_documents_updated_at
    BEFORE UPDATE ON property_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for documents (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
