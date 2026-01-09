import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supported platforms
const SUPPORTED_PLATFORMS = [
  'airbnb',
  'booking',
  'expat_dakar',
  'jumia_house',
  'coinafrique',
  'mamaison',
  'keur_immo',
] as const;

type Platform = typeof SUPPORTED_PLATFORMS[number];

/**
 * POST /api/intelligence/batch-scrape - Trigger a batch scrape job
 *
 * Body: { platform: string, city?: string, maxPages?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    const { platform, city = 'Dakar', maxPages = 3 } = body;

    // Validate platform
    if (!platform || !SUPPORTED_PLATFORMS.includes(platform as Platform)) {
      return NextResponse.json(
        {
          error: 'Invalid platform',
          supported: SUPPORTED_PLATFORMS,
        },
        { status: 400 }
      );
    }

    // Create a scrape job record
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .insert({
        platform,
        job_type: 'full_scan',
        target_params: { city, maxPages },
        status: 'pending',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating scrape job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create scrape job', details: jobError.message },
        { status: 500 }
      );
    }

    // In a real deployment, this would trigger the scraper service
    // For now, we'll just return the job record
    // TODO: Implement webhook or message queue to trigger scraper-service

    return NextResponse.json({
      success: true,
      message: `Scrape job created for ${platform} in ${city}`,
      job: {
        id: job.id,
        platform: job.platform,
        status: job.status,
        city,
        maxPages,
        createdAt: job.started_at,
      },
      note: 'Scraper service needs to be running to process this job. Run: cd services/scraper-service && npm start',
    });

  } catch (error) {
    console.error('Batch scrape error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/intelligence/batch-scrape - Get supported platforms info
 */
export async function GET() {
  return NextResponse.json({
    platforms: SUPPORTED_PLATFORMS.map(p => ({
      id: p,
      name: p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      difficulty: getDifficultyLevel(p),
    })),
    cities: ['Dakar', 'Saint-Louis', 'Saly', 'Mbour', 'Cap Skirring', 'Thies'],
  });
}

function getDifficultyLevel(platform: string): 'easy' | 'medium' | 'hard' {
  const easy = ['expat_dakar', 'jumia_house', 'coinafrique', 'mamaison', 'keur_immo'];
  const medium = ['booking'];

  if (easy.includes(platform)) return 'easy';
  if (medium.includes(platform)) return 'medium';
  return 'hard';
}
