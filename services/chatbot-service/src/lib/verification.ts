/**
 * Guest Verification Module
 *
 * Provides real-time guest verification during check-in by:
 * 1. Checking internal watchlist (previous stays, flags in Supabase)
 * 2. Optionally querying OpenSanctions API for sanctions screening
 *
 * Returns a risk assessment with score (0-100) and level (LOW, MEDIUM, HIGH)
 */

import { supabase } from './supabase.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const OPENSANCTIONS_API_KEY = process.env.OPENSANCTIONS_API_KEY || '';
const OPENSANCTIONS_API_URL = 'https://api.opensanctions.org/match/default';

// Risk score thresholds
const HIGH_RISK_THRESHOLD = 70;
const MEDIUM_RISK_THRESHOLD = 40;

// =============================================================================
// TYPES
// =============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface GuestVerificationInput {
  firstName?: string;
  lastName?: string;
  nationality?: string;
  documentType?: string;
  documentNumber?: string;
  dateOfBirth?: string;
}

export interface InternalCheckResult {
  previousStays: number;
  hasFlags: boolean;
  flagDetails: string[];
  alertHistory: Array<{
    type: string;
    severity: string;
    description: string;
    created_at: string;
  }>;
}

export interface OpenSanctionsMatch {
  id: string;
  name: string;
  score: number;
  schema: string;
  datasets: string[];
  countries: string[];
}

export interface OpenSanctionsResult {
  checked: boolean;
  matches: OpenSanctionsMatch[];
  highestScore: number;
  error?: string;
}

export interface VerificationResult {
  riskScore: number;
  riskLevel: RiskLevel;
  internalCheck: InternalCheckResult;
  sanctionsCheck: OpenSanctionsResult;
  verifiedAt: string;
  reasons: string[];
}

// =============================================================================
// INTERNAL WATCHLIST CHECK
// =============================================================================

/**
 * Check guest against internal database for previous stays and any flags
 */
async function checkInternalWatchlist(
  guestData: GuestVerificationInput
): Promise<InternalCheckResult> {
  const result: InternalCheckResult = {
    previousStays: 0,
    hasFlags: false,
    flagDetails: [],
    alertHistory: [],
  };

  try {
    // Search for existing guest by document number
    let guestQuery = supabase
      .from('guests')
      .select('id, first_name, last_name, document_number, created_at');

    if (guestData.documentNumber) {
      guestQuery = guestQuery.eq('document_number', guestData.documentNumber);
    } else if (guestData.firstName && guestData.lastName) {
      // Fallback to name search if no document number
      guestQuery = guestQuery
        .ilike('first_name', guestData.firstName)
        .ilike('last_name', guestData.lastName);
    } else {
      // Not enough data to search
      console.log('[Verification] Insufficient data for internal watchlist check');
      return result;
    }

    const { data: existingGuests, error: guestError } = await guestQuery;

    if (guestError) {
      console.error('[Verification] Error querying guests:', guestError);
      return result;
    }

    if (!existingGuests || existingGuests.length === 0) {
      console.log('[Verification] No previous guest records found');
      return result;
    }

    const guestIds = existingGuests.map((g) => g.id);

    // Count previous stays
    const { count: stayCount, error: stayError } = await supabase
      .from('stays')
      .select('*', { count: 'exact', head: true })
      .in('guest_id', guestIds);

    if (!stayError && stayCount !== null) {
      result.previousStays = stayCount;
    }

    // Check for any alerts associated with this guest
    const { data: alerts, error: alertError } = await supabase
      .from('alerts')
      .select('type, severity, description, created_at, status')
      .in('guest_id', guestIds)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!alertError && alerts && alerts.length > 0) {
      result.alertHistory = alerts.map((a) => ({
        type: a.type,
        severity: a.severity,
        description: a.description || '',
        created_at: a.created_at,
      }));

      // Check for serious flags (high/critical severity or specific types)
      const seriousAlerts = alerts.filter(
        (a) =>
          a.severity === 'high' ||
          a.severity === 'critical' ||
          a.type === 'watchlist_match' ||
          a.type === 'fraud' ||
          a.type === 'identity_mismatch' ||
          (a.status !== 'resolved' && a.status !== 'dismissed')
      );

      if (seriousAlerts.length > 0) {
        result.hasFlags = true;
        result.flagDetails = seriousAlerts.map(
          (a) => `${a.type} (${a.severity}): ${a.description || 'Aucun detail'}`
        );
      }
    }

    console.log(
      `[Verification] Internal check complete: ${result.previousStays} previous stays, ${result.flagDetails.length} flags`
    );
  } catch (error) {
    console.error('[Verification] Internal watchlist check error:', error);
  }

  return result;
}

// =============================================================================
// OPENSANCTIONS API CHECK
// =============================================================================

/**
 * Check guest against OpenSanctions database for sanctions/watchlist matches
 * Only runs if OPENSANCTIONS_API_KEY is configured
 */
async function checkOpenSanctions(
  guestData: GuestVerificationInput
): Promise<OpenSanctionsResult> {
  const result: OpenSanctionsResult = {
    checked: false,
    matches: [],
    highestScore: 0,
  };

  // Skip if API key not configured
  if (!OPENSANCTIONS_API_KEY) {
    console.log('[Verification] OpenSanctions API key not configured, skipping sanctions check');
    return result;
  }

  // Need at least a name to search
  if (!guestData.firstName && !guestData.lastName) {
    console.log('[Verification] Insufficient data for OpenSanctions check');
    return result;
  }

  try {
    const fullName = [guestData.firstName, guestData.lastName].filter(Boolean).join(' ');

    // Build request payload per OpenSanctions API spec
    const payload: Record<string, unknown> = {
      schema: 'Person',
      properties: {
        name: [fullName],
      },
    };

    // Add optional properties if available
    if (guestData.nationality) {
      payload.properties = {
        ...(payload.properties as Record<string, unknown>),
        nationality: [guestData.nationality],
      };
    }

    if (guestData.dateOfBirth) {
      payload.properties = {
        ...(payload.properties as Record<string, unknown>),
        birthDate: [guestData.dateOfBirth],
      };
    }

    if (guestData.documentNumber) {
      payload.properties = {
        ...(payload.properties as Record<string, unknown>),
        idNumber: [guestData.documentNumber],
      };
    }

    console.log(`[Verification] Checking OpenSanctions for: ${fullName}`);

    const response = await fetch(OPENSANCTIONS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${OPENSANCTIONS_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Verification] OpenSanctions API error: ${response.status} - ${errorText}`);
      result.error = `API error: ${response.status}`;
      return result;
    }

    const data = await response.json();
    result.checked = true;

    // Process results
    if (data.results && Array.isArray(data.results)) {
      result.matches = data.results.map((r: any) => ({
        id: r.id,
        name: r.caption || r.name,
        score: r.score || 0,
        schema: r.schema,
        datasets: r.datasets || [],
        countries: r.properties?.country || [],
      }));

      if (result.matches.length > 0) {
        result.highestScore = Math.max(...result.matches.map((m) => m.score));
      }

      console.log(
        `[Verification] OpenSanctions found ${result.matches.length} matches, highest score: ${result.highestScore}`
      );
    }
  } catch (error) {
    console.error('[Verification] OpenSanctions check error:', error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return result;
}

// =============================================================================
// RISK CALCULATION
// =============================================================================

/**
 * Calculate overall risk score based on internal and sanctions checks
 */
function calculateRiskScore(
  internalCheck: InternalCheckResult,
  sanctionsCheck: OpenSanctionsResult
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Internal flags contribute significantly to risk
  if (internalCheck.hasFlags) {
    const flagCount = internalCheck.flagDetails.length;
    const flagScore = Math.min(flagCount * 25, 60); // Up to 60 points from flags
    score += flagScore;
    reasons.push(`${flagCount} alerte(s) precedente(s) dans le systeme`);

    // Check for specific high-severity flags
    const criticalFlags = internalCheck.flagDetails.filter(
      (f) => f.includes('critical') || f.includes('fraud') || f.includes('watchlist')
    );
    if (criticalFlags.length > 0) {
      score += 20;
      reasons.push('Alertes critiques detectees');
    }
  }

  // Previous stays with issues
  const alertRatio =
    internalCheck.previousStays > 0
      ? internalCheck.alertHistory.length / internalCheck.previousStays
      : 0;

  if (alertRatio > 0.5 && internalCheck.previousStays >= 2) {
    score += 15;
    reasons.push('Historique de sejours problematiques');
  }

  // OpenSanctions matches
  if (sanctionsCheck.checked && sanctionsCheck.matches.length > 0) {
    // High confidence match (score > 0.7)
    if (sanctionsCheck.highestScore > 0.7) {
      score += 50;
      reasons.push(`Correspondance sanctions forte (score: ${Math.round(sanctionsCheck.highestScore * 100)}%)`);
    }
    // Medium confidence match (score > 0.5)
    else if (sanctionsCheck.highestScore > 0.5) {
      score += 30;
      reasons.push(`Correspondance sanctions possible (score: ${Math.round(sanctionsCheck.highestScore * 100)}%)`);
    }
    // Low confidence match (any match)
    else if (sanctionsCheck.matches.length > 0) {
      score += 10;
      reasons.push(`Correspondance sanctions faible (${sanctionsCheck.matches.length} resultat(s))`);
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // If no risk factors found, add reason
  if (reasons.length === 0) {
    reasons.push('Aucun facteur de risque detecte');
  }

  return { score, reasons };
}

/**
 * Convert numeric score to risk level
 */
function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= HIGH_RISK_THRESHOLD) {
    return 'HIGH';
  } else if (score >= MEDIUM_RISK_THRESHOLD) {
    return 'MEDIUM';
  }
  return 'LOW';
}

// =============================================================================
// MAIN VERIFICATION FUNCTION
// =============================================================================

/**
 * Verify a guest against internal watchlist and external sanctions databases
 *
 * @param guestData - Guest information to verify
 * @returns VerificationResult with risk score, level, and detailed findings
 */
export async function verifyGuest(
  guestData: GuestVerificationInput
): Promise<VerificationResult> {
  console.log('[Verification] Starting guest verification:', {
    name: `${guestData.firstName} ${guestData.lastName}`,
    documentNumber: guestData.documentNumber ? '***' + guestData.documentNumber.slice(-4) : 'N/A',
    nationality: guestData.nationality,
  });

  // Run both checks in parallel for efficiency
  const [internalCheck, sanctionsCheck] = await Promise.all([
    checkInternalWatchlist(guestData),
    checkOpenSanctions(guestData),
  ]);

  // Calculate risk
  const { score, reasons } = calculateRiskScore(internalCheck, sanctionsCheck);
  const riskLevel = scoreToRiskLevel(score);

  const result: VerificationResult = {
    riskScore: score,
    riskLevel,
    internalCheck,
    sanctionsCheck,
    verifiedAt: new Date().toISOString(),
    reasons,
  };

  console.log(`[Verification] Complete - Risk: ${riskLevel} (${score}/100)`);

  return result;
}

// =============================================================================
// DATABASE STORAGE
// =============================================================================

/**
 * Store verification result in guest_verifications table
 */
export async function storeVerificationResult(
  guestId: string,
  stayId: string,
  propertyId: string,
  verificationResult: VerificationResult
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('guest_verifications')
      .insert({
        guest_id: guestId,
        stay_id: stayId,
        property_id: propertyId,
        risk_score: verificationResult.riskScore,
        risk_level: verificationResult.riskLevel,
        internal_check_result: verificationResult.internalCheck,
        sanctions_check_result: verificationResult.sanctionsCheck,
        reasons: verificationResult.reasons,
        verified_at: verificationResult.verifiedAt,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Verification] Error storing verification result:', error);
      return null;
    }

    console.log(`[Verification] Stored verification result with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('[Verification] Error storing verification result:', error);
    return null;
  }
}

/**
 * Create a HIGH risk alert for a guest
 */
export async function createHighRiskAlert(
  guestId: string,
  stayId: string,
  propertyId: string,
  verificationResult: VerificationResult
): Promise<string | null> {
  try {
    const description = `Verification a haut risque detectee (score: ${verificationResult.riskScore}/100). Raisons: ${verificationResult.reasons.join('; ')}`;

    const { data, error } = await supabase
      .from('alerts')
      .insert({
        type: 'high_risk_guest',
        severity: 'high',
        title: 'Client a haut risque detecte',
        description,
        property_id: propertyId,
        guest_id: guestId,
        stay_id: stayId,
        status: 'new',
        auto_generated: true,
        metadata: {
          risk_score: verificationResult.riskScore,
          risk_level: verificationResult.riskLevel,
          reasons: verificationResult.reasons,
          sanctions_matches: verificationResult.sanctionsCheck.matches.length,
          internal_flags: verificationResult.internalCheck.flagDetails.length,
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Verification] Error creating high risk alert:', error);
      return null;
    }

    console.log(`[Verification] Created high risk alert with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('[Verification] Error creating high risk alert:', error);
    return null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  verifyGuest,
  storeVerificationResult,
  createHighRiskAlert,
};
