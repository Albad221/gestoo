/**
 * Enrichment API Routes
 *
 * Provides REST API endpoints for person enrichment and verification.
 *
 * Endpoints:
 * - POST /api/intelligence/enrich - Enrich a person's data from phone, email, or name
 * - POST /api/intelligence/verify - Verify a person against sanctions and watchlists
 * - POST /api/intelligence/phone-lookup - Direct phone lookup
 * - POST /api/intelligence/email-lookup - Direct email lookup
 * - POST /api/intelligence/sanctions-check - Direct sanctions check
 * - POST /api/intelligence/watchlist-check - Direct watchlist check
 */

import { Router, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

import {
  enrichPerson,
  verifyPerson,
  runAllPhoneLookups,
  runAllEmailEnrichment,
  runAllSanctionsChecks,
  runAllWatchlistChecks,
  checkPEP,
  getInterpolNoticeDetails,
  type EnrichmentRequest,
  type VerificationRequest,
} from '../enrichment';

export function createEnrichmentRouter(supabase: SupabaseClient): Router {
  const router = Router();

  /**
   * POST /api/intelligence/enrich
   *
   * Enrich a person's data from phone, email, or name.
   * Aggregates data from multiple OSINT sources.
   *
   * Request body:
   * {
   *   phone?: string,       // Phone number (with or without country code)
   *   email?: string,       // Email address
   *   name?: string,        // Full name
   *   dateOfBirth?: string, // Date of birth (YYYY-MM-DD)
   *   nationality?: string, // Nationality/country code
   *   options?: {
   *     includeSanctions?: boolean,      // Check sanctions (default: true)
   *     includeWatchlists?: boolean,     // Check watchlists (default: true)
   *     includeEnrichment?: boolean,     // Include enrichment (default: true)
   *     includeSocialProfiles?: boolean, // Include social profiles (default: true)
   *   }
   * }
   */
  router.post('/enrich', async (req: Request, res: Response) => {
    try {
      const request: EnrichmentRequest = req.body;

      // Validate input
      if (!request.phone && !request.email && !request.name) {
        return res.status(400).json({
          success: false,
          error: 'At least one of phone, email, or name is required',
        });
      }

      const result = await enrichPerson(request);

      // Log the enrichment request (optional - for audit trail)
      try {
        await supabase.from('enrichment_logs').insert({
          request_id: result.requestId,
          input_type: request.phone ? 'phone' : request.email ? 'email' : 'name',
          input_value: request.phone || request.email || request.name,
          risk_score: result.risk.score,
          risk_level: result.risk.level,
          sources_used: result.sources,
          processing_time: result.processingTime,
          created_at: new Date().toISOString(),
        });
      } catch (logError) {
        // Non-critical - continue even if logging fails
        console.warn('Failed to log enrichment request:', logError);
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Enrichment error:', error);
      return res.status(500).json({
        success: false,
        error: 'Enrichment failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/intelligence/verify
   *
   * Verify a person against sanctions and watchlists.
   * Returns a verification status (clear, review, flagged, blocked).
   *
   * Request body:
   * {
   *   firstName: string,        // First name (required)
   *   lastName: string,         // Last name (required)
   *   dateOfBirth?: string,     // Date of birth (YYYY-MM-DD)
   *   nationality?: string,     // Nationality/country code
   *   documentNumber?: string,  // Document number
   *   options?: {
   *     strictMatch?: boolean,   // Use strict matching (default: false)
   *     minScore?: number,       // Minimum match score (default: 60)
   *     checkSanctions?: boolean, // Check sanctions (default: true)
   *     checkInterpol?: boolean,  // Check INTERPOL (default: true)
   *     checkFBI?: boolean,       // Check FBI (default: true)
   *     checkEuropol?: boolean,   // Check Europol (default: true)
   *   }
   * }
   */
  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const request: VerificationRequest = req.body;

      // Validate input
      if (!request.firstName || !request.lastName) {
        return res.status(400).json({
          success: false,
          error: 'firstName and lastName are required',
        });
      }

      const result = await verifyPerson(request);

      // Log the verification request (for audit trail)
      try {
        await supabase.from('verification_logs').insert({
          request_id: result.requestId,
          full_name: result.input.fullName,
          date_of_birth: result.input.dateOfBirth,
          nationality: result.input.nationality,
          status: result.status,
          risk_score: result.risk.score,
          risk_level: result.risk.level,
          is_pep: result.risk.isPEP,
          sanctions_match: result.sanctions.isMatch,
          watchlist_match: result.watchlists.isMatch,
          sources_checked: result.sourcesChecked,
          processing_time: result.processingTime,
          created_at: new Date().toISOString(),
        });
      } catch (logError) {
        // Non-critical - continue even if logging fails
        console.warn('Failed to log verification request:', logError);
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Verification error:', error);
      return res.status(500).json({
        success: false,
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/intelligence/phone-lookup
   *
   * Direct phone number lookup using Truecaller and Numverify.
   *
   * Request body:
   * {
   *   phone: string  // Phone number to lookup
   * }
   */
  router.post('/phone-lookup', async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          error: 'phone is required',
        });
      }

      const result = await runAllPhoneLookups(phone);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Phone lookup error:', error);
      return res.status(500).json({
        success: false,
        error: 'Phone lookup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/intelligence/email-lookup
   *
   * Direct email lookup and enrichment.
   *
   * Request body:
   * {
   *   email: string  // Email address to lookup
   * }
   */
  router.post('/email-lookup', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'email is required',
        });
      }

      const result = await runAllEmailEnrichment(email);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Email lookup error:', error);
      return res.status(500).json({
        success: false,
        error: 'Email lookup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/intelligence/sanctions-check
   *
   * Check a name against sanctions databases.
   *
   * Request body:
   * {
   *   name: string,           // Full name to check
   *   dateOfBirth?: string,   // Date of birth (YYYY-MM-DD)
   *   nationality?: string    // Nationality/country code
   * }
   */
  router.post('/sanctions-check', async (req: Request, res: Response) => {
    try {
      const { name, dateOfBirth, nationality } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'name is required',
        });
      }

      const result = await runAllSanctionsChecks(name, dateOfBirth, nationality);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Sanctions check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Sanctions check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/intelligence/watchlist-check
   *
   * Check a name against law enforcement watchlists.
   *
   * Request body:
   * {
   *   name: string,           // Full name to check
   *   nationality?: string,   // Nationality/country code
   *   dateOfBirth?: string    // Date of birth (YYYY-MM-DD)
   * }
   */
  router.post('/watchlist-check', async (req: Request, res: Response) => {
    try {
      const { name, nationality, dateOfBirth } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'name is required',
        });
      }

      const result = await runAllWatchlistChecks(name, nationality, dateOfBirth);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Watchlist check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Watchlist check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/intelligence/pep-check
   *
   * Check if a person is a Politically Exposed Person (PEP).
   *
   * Request body:
   * {
   *   name: string,           // Full name to check
   *   nationality?: string    // Nationality/country code
   * }
   */
  router.post('/pep-check', async (req: Request, res: Response) => {
    try {
      const { name, nationality } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'name is required',
        });
      }

      const result = await checkPEP(name, nationality);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('PEP check error:', error);
      return res.status(500).json({
        success: false,
        error: 'PEP check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/intelligence/interpol/:entityId
   *
   * Get detailed information about a specific INTERPOL notice.
   */
  router.get('/interpol/:entityId', async (req: Request, res: Response) => {
    try {
      const { entityId } = req.params;

      if (!entityId) {
        return res.status(400).json({
          success: false,
          error: 'entityId is required',
        });
      }

      const result = await getInterpolNoticeDetails(entityId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error || 'Notice not found',
        });
      }

      return res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error('INTERPOL details error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get INTERPOL notice details',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/intelligence/batch-verify
   *
   * Verify multiple persons in batch.
   * Limited to 50 persons per request.
   *
   * Request body:
   * {
   *   persons: Array<{
   *     firstName: string,
   *     lastName: string,
   *     dateOfBirth?: string,
   *     nationality?: string
   *   }>,
   *   options?: {
   *     strictMatch?: boolean,
   *     minScore?: number
   *   }
   * }
   */
  router.post('/batch-verify', async (req: Request, res: Response) => {
    try {
      const { persons, options } = req.body;

      if (!Array.isArray(persons) || persons.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'persons array is required and must not be empty',
        });
      }

      if (persons.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 50 persons per batch request',
        });
      }

      // Validate all persons have required fields
      for (let i = 0; i < persons.length; i++) {
        if (!persons[i].firstName || !persons[i].lastName) {
          return res.status(400).json({
            success: false,
            error: `Person at index ${i} is missing firstName or lastName`,
          });
        }
      }

      // Process in parallel with concurrency limit
      const results = await Promise.all(
        persons.map(person =>
          verifyPerson({
            firstName: person.firstName,
            lastName: person.lastName,
            dateOfBirth: person.dateOfBirth,
            nationality: person.nationality,
            options,
          })
        )
      );

      // Summary statistics
      const summary = {
        total: results.length,
        clear: results.filter(r => r.status === 'clear').length,
        review: results.filter(r => r.status === 'review').length,
        flagged: results.filter(r => r.status === 'flagged').length,
        blocked: results.filter(r => r.status === 'blocked').length,
      };

      return res.json({
        success: true,
        data: {
          summary,
          results,
        },
      });
    } catch (error) {
      console.error('Batch verify error:', error);
      return res.status(500).json({
        success: false,
        error: 'Batch verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
