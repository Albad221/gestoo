import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ScrapedListing {
  platform: string;
  platform_id: string;
  url: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  location_text: string;
  city: string;
  region: string;
  host_name: string;
  num_rooms: number;
  num_guests: number;
  photos: string[];
  amenities: string[];
  rating: number;
  num_reviews: number;
}

/**
 * POST /api/intelligence/scrape - Scrape and analyze listings from a URL
 * Uses AI to extract structured data from listing pages
 */
export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { url, platform } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Detect platform from URL if not provided
    const detectedPlatform = platform || detectPlatform(url);

    // Fetch the page content
    const pageContent = await fetchPageContent(url);
    if (!pageContent) {
      return NextResponse.json({ error: 'Failed to fetch page content' }, { status: 500 });
    }

    // Use AI to extract structured listing data
    const listing = await extractListingWithAI(pageContent, url, detectedPlatform);
    if (!listing) {
      return NextResponse.json({ error: 'Failed to extract listing data' }, { status: 500 });
    }

    // Check if this listing already exists
    const { data: existingListing } = await supabase
      .from('scraped_listings')
      .select('id')
      .eq('url', url)
      .single();

    // Match against registered properties
    const matchResult = await matchWithRegisteredProperties(supabase, listing);

    // Prepare listing record (matching database schema)
    const listingRecord = {
      platform: listing.platform,
      platform_id: listing.platform_id,
      url: listing.url,
      title: listing.title,
      description: listing.description,
      price_per_night: listing.price,
      price: listing.price,
      currency: listing.currency,
      location_text: listing.location_text,
      city: listing.city,
      region: listing.region,
      host_name: listing.host_name,
      bedrooms: listing.num_rooms,
      max_guests: listing.num_guests,
      photos: listing.photos,
      amenities: listing.amenities,
      rating: listing.rating,
      review_count: listing.num_reviews,
      is_active: true,
      matched_property_id: matchResult.matchedPropertyId,
      is_compliant: matchResult.isCompliant,
      compliance_checked_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    };

    let savedListing;
    if (existingListing) {
      // Update existing listing
      const { data, error } = await supabase
        .from('scraped_listings')
        .update(listingRecord)
        .eq('id', existingListing.id)
        .select()
        .single();

      if (error) throw error;
      savedListing = data;
    } else {
      // Insert new listing
      const { data, error } = await supabase
        .from('scraped_listings')
        .insert({
          ...listingRecord,
          first_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      savedListing = data;

      // Create alert if unregistered
      if (!matchResult.isCompliant) {
        await createUnregisteredPropertyAlert(supabase, savedListing, listing);
      }
    }

    return NextResponse.json({
      success: true,
      listing: savedListing,
      match: matchResult,
      isNew: !existingListing,
    });

  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Failed to scrape listing', details: String(error) }, { status: 500 });
  }
}

/**
 * GET /api/intelligence/scrape - Get scraping stats and recent listings
 */
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get stats
    const { data: allListings } = await supabase
      .from('scraped_listings')
      .select('id, is_compliant, platform, city, matched_property_id');

    const listings = allListings || [];
    const stats = {
      total: listings.length,
      compliant: listings.filter(l => l.is_compliant).length,
      nonCompliant: listings.filter(l => !l.is_compliant).length,
      unmatched: listings.filter(l => !l.matched_property_id).length,
      byPlatform: {} as Record<string, number>,
      byCity: {} as Record<string, number>,
    };

    listings.forEach(l => {
      stats.byPlatform[l.platform] = (stats.byPlatform[l.platform] || 0) + 1;
      if (l.city) {
        stats.byCity[l.city] = (stats.byCity[l.city] || 0) + 1;
      }
    });

    // Get recent non-compliant listings
    const { data: recentNonCompliant } = await supabase
      .from('scraped_listings')
      .select('*')
      .eq('is_compliant', false)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      stats,
      recentNonCompliant: recentNonCompliant || [],
    });

  } catch (error) {
    console.error('Get scrape stats error:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

function detectPlatform(url: string): string {
  if (url.includes('airbnb')) return 'airbnb';
  if (url.includes('booking.com')) return 'booking';
  if (url.includes('expedia')) return 'expedia';
  if (url.includes('vrbo')) return 'vrbo';
  if (url.includes('tripadvisor')) return 'tripadvisor';
  return 'other';
}

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch URL:', response.status);
      return null;
    }

    const html = await response.text();
    // Clean HTML - remove scripts, styles, and extract text
    const cleanedHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); // Limit to 15k chars for AI

    return cleanedHtml;
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

async function extractListingWithAI(content: string, url: string, platform: string): Promise<ScrapedListing | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a data extraction expert. Extract rental property listing information from the provided text content.
Return ONLY valid JSON with these fields:
{
  "title": "listing title",
  "description": "short description",
  "price": number (per night, in local currency),
  "currency": "XOF" or detected currency,
  "location_text": "full address or location description",
  "city": "city name (e.g., Dakar, Saint-Louis, Saly)",
  "region": "region name (e.g., Dakar, Thiès, Saint-Louis)",
  "host_name": "host/owner name if found",
  "num_rooms": number of bedrooms,
  "num_guests": max guests,
  "amenities": ["wifi", "pool", "parking", etc],
  "rating": number (0-5),
  "num_reviews": number
}
Focus on properties in Senegal. If a field is not found, use null.`
          },
          {
            role: 'user',
            content: `Extract listing data from this ${platform} page:\n\nURL: ${url}\n\nContent:\n${content}`
          }
        ],
        max_tokens: 1000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI error:', await response.text());
      return null;
    }

    const result = await response.json();
    const aiContent = result.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const extracted = JSON.parse(jsonMatch[0]);

    // Generate platform_id from URL
    const platformId = extractPlatformId(url, platform);

    return {
      platform,
      platform_id: platformId,
      url,
      title: extracted.title || 'Unknown Listing',
      description: extracted.description || '',
      price: extracted.price || 0,
      currency: extracted.currency || 'XOF',
      location_text: extracted.location_text || '',
      city: extracted.city || '',
      region: extracted.region || '',
      host_name: extracted.host_name || '',
      num_rooms: extracted.num_rooms || 0,
      num_guests: extracted.num_guests || 0,
      photos: [],
      amenities: extracted.amenities || [],
      rating: extracted.rating || 0,
      num_reviews: extracted.num_reviews || 0,
    };

  } catch (error) {
    console.error('AI extraction error:', error);
    return null;
  }
}

function extractPlatformId(url: string, platform: string): string {
  try {
    const urlObj = new URL(url);

    if (platform === 'airbnb') {
      const match = url.match(/rooms\/(\d+)/);
      return match ? match[1] : urlObj.pathname;
    }
    if (platform === 'booking') {
      const match = url.match(/hotel\/[^/]+\/([^.]+)/);
      return match ? match[1] : urlObj.pathname;
    }

    return urlObj.pathname;
  } catch {
    return url;
  }
}

async function matchWithRegisteredProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  listing: ScrapedListing
): Promise<{ matchedPropertyId: string | null; isCompliant: boolean; confidence: number }> {

  // Get registered properties in the same city
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, address, city, region, num_rooms, max_guests, registration_number')
    .or(`city.ilike.%${listing.city}%,region.ilike.%${listing.region}%`);

  if (!properties || properties.length === 0) {
    return { matchedPropertyId: null, isCompliant: false, confidence: 0 };
  }

  // Score each property for similarity
  let bestMatch: { id: string; score: number } | null = null;

  for (const property of properties) {
    let score = 0;

    // Name similarity
    if (listing.title && property.name) {
      const nameSimilarity = calculateSimilarity(
        listing.title.toLowerCase(),
        property.name.toLowerCase()
      );
      score += nameSimilarity * 30;
    }

    // Address/location similarity
    if (listing.location_text && property.address) {
      const addressSimilarity = calculateSimilarity(
        listing.location_text.toLowerCase(),
        property.address.toLowerCase()
      );
      score += addressSimilarity * 25;
    }

    // City match
    if (listing.city && property.city &&
        listing.city.toLowerCase() === property.city.toLowerCase()) {
      score += 20;
    }

    // Room count match
    if (listing.num_rooms && property.num_rooms &&
        listing.num_rooms === property.num_rooms) {
      score += 15;
    }

    // Guest capacity similarity
    if (listing.num_guests && property.max_guests) {
      const guestDiff = Math.abs(listing.num_guests - property.max_guests);
      if (guestDiff <= 2) score += 10;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { id: property.id, score };
    }
  }

  // Consider it a match if score > 50
  const isMatch = bestMatch && bestMatch.score > 50;
  const matchedProperty = isMatch ? properties.find((p: { id: string; registration_number: string | null }) => p.id === bestMatch!.id) : null;

  return {
    matchedPropertyId: isMatch ? bestMatch!.id : null,
    isCompliant: isMatch && !!matchedProperty?.registration_number,
    confidence: bestMatch?.score || 0,
  };
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let matches = 0;
  words1.forEach(word => {
    if (words2.has(word)) matches++;
  });

  return matches / Math.max(words1.size, words2.size);
}

async function createUnregisteredPropertyAlert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  savedListing: { id: string; city: string },
  listing: ScrapedListing
): Promise<void> {
  try {
    await supabase.from('alerts').insert({
      type: 'unregistered_property',
      severity: 'high',
      status: 'open',
      title: `Propriété non enregistrée: ${listing.title}`,
      description: `Une annonce ${listing.platform} à ${listing.city} ne correspond à aucune propriété enregistrée. Hôte: ${listing.host_name || 'Inconnu'}. Prix: ${listing.price} ${listing.currency}/nuit.`,
      scraped_listing_id: savedListing.id,
      location_city: listing.city,
      location_region: listing.region,
      metadata: {
        platform: listing.platform,
        url: listing.url,
        host_name: listing.host_name,
        price: listing.price,
        num_rooms: listing.num_rooms,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to create alert:', error);
  }
}
