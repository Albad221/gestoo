import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('Creating missing tables...');

  // Create scrape_jobs table
  const { error: error1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS scrape_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL,
        job_type TEXT NOT NULL,
        target_params JSONB,
        status TEXT DEFAULT 'pending',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        listings_found INTEGER DEFAULT 0,
        listings_new INTEGER DEFAULT 0,
        listings_updated INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (error1) {
    console.log('Note: scrape_jobs table may already exist or needs manual creation');
    console.log('Error:', error1.message);
  } else {
    console.log('scrape_jobs table created');
  }

  // Test if we can insert into scrape_jobs (checks if table exists)
  const { data, error: testError } = await supabase
    .from('scrape_jobs')
    .select('count')
    .limit(1);

  if (testError) {
    console.log('Table check failed:', testError.message);
    console.log('\n⚠️  You need to run the migration manually in Supabase dashboard:');
    console.log('   1. Go to https://app.supabase.com/project/qqwdxyeqenaaltzfxqla/sql');
    console.log('   2. Run the SQL from: supabase/migrations/00005_intelligence_module.sql');
  } else {
    console.log('✅ scrape_jobs table exists and is accessible');
  }
}

createTables().catch(console.error);
