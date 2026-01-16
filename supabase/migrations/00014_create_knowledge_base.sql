-- Knowledge Base for TPT/Landlord Tax FAQ
-- Migration: 00014_create_knowledge_base.sql

-- FAQ Categories
CREATE TABLE IF NOT EXISTS faq_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_fr TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ Entries
CREATE TABLE IF NOT EXISTS faq_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES faq_categories(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}', -- For keyword matching
  search_vector TSVECTOR, -- PostgreSQL full-text search
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search Indexes
CREATE INDEX IF NOT EXISTS idx_faq_keywords ON faq_entries USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_faq_search ON faq_entries USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_faq_category ON faq_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_faq_active ON faq_entries(is_active);

-- Auto-update search vector on insert/update
CREATE OR REPLACE FUNCTION update_faq_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('french', COALESCE(NEW.question, '') || ' ' || COALESCE(NEW.answer, ''));
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS faq_search_update ON faq_entries;
CREATE TRIGGER faq_search_update
  BEFORE INSERT OR UPDATE ON faq_entries
  FOR EACH ROW EXECUTE FUNCTION update_faq_search_vector();

-- Function to search FAQ entries
CREATE OR REPLACE FUNCTION search_faq(search_query TEXT, max_results INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  category_id UUID,
  question TEXT,
  answer TEXT,
  keywords TEXT[],
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.category_id,
    f.question,
    f.answer,
    f.keywords,
    ts_rank(f.search_vector, plainto_tsquery('french', search_query)) AS rank
  FROM faq_entries f
  WHERE f.is_active = true
    AND (
      f.search_vector @@ plainto_tsquery('french', search_query)
      OR search_query = ANY(f.keywords)
      OR f.question ILIKE '%' || search_query || '%'
      OR f.answer ILIKE '%' || search_query || '%'
    )
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_faq_view(faq_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE faq_entries SET view_count = view_count + 1 WHERE id = faq_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow public read access
CREATE POLICY "Allow public read on faq_categories"
  ON faq_categories
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow public read on faq_entries"
  ON faq_entries
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- Admin-only write access
CREATE POLICY "Allow admin write on faq_categories"
  ON faq_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Allow admin write on faq_entries"
  ON faq_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- Comments
COMMENT ON TABLE faq_categories IS 'Categories for organizing FAQ entries';
COMMENT ON TABLE faq_entries IS 'FAQ entries for the knowledge base, used for RAG-based responses';
COMMENT ON FUNCTION search_faq IS 'Full-text search function for FAQ entries with ranking';
