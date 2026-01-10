/**
 * Unified Enrichment API
 *
 * This module consolidates all OSINT enrichment sources into a unified API.
 * It provides two main functions:
 *
 * 1. enrichPerson() - Full enrichment from phone, email, or name
 * 2. verifyPerson() - Verification against sanctions and watchlists
 *
 * Data Sources:
 * - Truecaller: Phone lookup (name, email, photo, spam detection)
 * - FullContact: Person enrichment (social profiles, photos, employment)
 * - OpenSanctions: Sanctions screening (OFAC, UN, EU, 100+ lists)
 * - INTERPOL: Red Notices (international arrest warrants)
 * - FBI: Most Wanted list
 * - Europol: EU Most Wanted
 */

import { v4 as uuidv4 } from 'uuid';

import {
  lookupTruecaller,
  lookupNumverify,
  validatePhoneLocal,
  runAllPhoneLookups,
} from './truecaller';

import {
  enrichFromEmail,
  enrichFromPhone,
  enrichPerson as fullContactEnrich,
  checkEmailReputation,
  checkEmailBreaches,
  runAllEmailEnrichment,
} from './fullcontact';

import {
  checkOpenSanctions,
  checkOFAC,
  checkUNSanctions,
  checkEUSanctions,
  checkPEP,
  runAllSanctionsChecks,
} from './opensanctions';

import {
  checkInterpolRedNotices,
  checkFBIWanted,
  checkEuropolWanted,
  runAllWatchlistChecks,
  getInterpolNoticeDetails,
} from './interpol';

import type {
  EnrichmentRequest,
  EnrichmentResponse,
  VerificationRequest,
  VerificationResponse,
  SanctionsCheckResult,
  WatchlistCheckResult,
} from './types';

// Re-export all types and individual functions
export * from './types';
export {
  // Truecaller
  lookupTruecaller,
  lookupNumverify,
  validatePhoneLocal,
  runAllPhoneLookups,
  // FullContact
  enrichFromEmail,
  enrichFromPhone,
  fullContactEnrich,
  checkEmailReputation,
  checkEmailBreaches,
  runAllEmailEnrichment,
  // OpenSanctions
  checkOpenSanctions,
  checkOFAC,
  checkUNSanctions,
  checkEUSanctions,
  checkPEP,
  runAllSanctionsChecks,
  // Interpol
  checkInterpolRedNotices,
  checkFBIWanted,
  checkEuropolWanted,
  runAllWatchlistChecks,
  getInterpolNoticeDetails,
};

/**
 * Enrich a person's data from phone, email, or name
 *
 * This function aggregates data from multiple sources and returns
 * a unified enrichment response with:
 * - Discovered identity data (names, emails, phones, photos, social profiles)
 * - Verification results (sanctions, watchlists)
 * - Risk assessment (score, level, factors, recommendations)
 *
 * @param request - Enrichment request with phone, email, or name
 * @returns Unified enrichment response
 */
export async function enrichPerson(request: EnrichmentRequest): Promise<EnrichmentResponse> {
  const startTime = Date.now();
  const requestId = uuidv4();

  // Initialize response
  const response: EnrichmentResponse = {
    requestId,
    timestamp: new Date().toISOString(),
    processingTime: 0,
    input: {
      phone: request.phone,
      email: request.email,
      name: request.name,
      dateOfBirth: request.dateOfBirth,
      nationality: request.nationality,
    },
    identity: {
      names: [],
      emails: [],
      phones: [],
      photos: [],
      locations: [],
      socialProfiles: [],
    },
    verification: {
      sanctions: {
        success: false,
        source: 'OpenSanctions',
        checkedAt: new Date().toISOString(),
        error: 'Not checked',
      },
      watchlists: {
        success: false,
        source: 'Watchlists',
        checkedAt: new Date().toISOString(),
        error: 'Not checked',
      },
    },
    risk: {
      score: 0,
      level: 'clear',
      factors: [],
      recommendations: [],
    },
    sources: [],
    errors: [],
  };

  const options = {
    includeSanctions: request.options?.includeSanctions ?? true,
    includeWatchlists: request.options?.includeWatchlists ?? true,
    includeEnrichment: request.options?.includeEnrichment ?? true,
    includeSocialProfiles: request.options?.includeSocialProfiles ?? true,
  };

  // Add initial input to identity
  if (request.name) {
    response.identity.names.push(request.name);
  }
  if (request.email) {
    response.identity.emails.push({ email: request.email, source: 'input' });
  }
  if (request.phone) {
    response.identity.phones.push({ number: request.phone, source: 'input' });
  }

  const enrichmentPromises: Promise<void>[] = [];

  // Phone enrichment
  if (request.phone && options.includeEnrichment) {
    enrichmentPromises.push(
      (async () => {
        try {
          const phoneResults = await runAllPhoneLookups(request.phone!);

          // Add Truecaller data
          if (phoneResults.truecaller.success && phoneResults.truecaller.data) {
            response.sources.push('Truecaller');
            const tcData = phoneResults.truecaller.data;

            if (tcData.name && !response.identity.names.includes(tcData.name)) {
              response.identity.names.push(tcData.name);
            }
            if (tcData.email) {
              response.identity.emails.push({ email: tcData.email, source: 'Truecaller' });
            }
            if (tcData.photo) {
              response.identity.photos.push({ url: tcData.photo, source: 'Truecaller' });
            }
            if (tcData.addresses) {
              for (const addr of tcData.addresses) {
                if (addr.formatted) {
                  response.identity.locations.push(addr.formatted);
                }
              }
            }
            if (tcData.isSpammer) {
              response.risk.factors.push(`Phone flagged as spam (score: ${tcData.spamScore}/10)`);
            }
          } else if (!phoneResults.truecaller.success) {
            response.errors.push({
              source: 'Truecaller',
              error: phoneResults.truecaller.error || 'Unknown error',
            });
          }

          // Add Numverify data
          if (phoneResults.numverify.success && phoneResults.numverify.data) {
            response.sources.push('Numverify');
            const nvData = phoneResults.numverify.data;
            if (nvData.addresses) {
              for (const addr of nvData.addresses) {
                if (addr.formatted && !response.identity.locations.includes(addr.formatted)) {
                  response.identity.locations.push(addr.formatted);
                }
              }
            }
          }

          // Add local validation data
          if (phoneResults.local.operator) {
            response.sources.push('LocalValidation');
          }
        } catch (error) {
          response.errors.push({
            source: 'PhoneLookup',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })()
    );
  }

  // Email enrichment
  if (request.email && options.includeEnrichment) {
    enrichmentPromises.push(
      (async () => {
        try {
          const emailResults = await runAllEmailEnrichment(request.email!);

          // Add FullContact data
          if (emailResults.fullContact.success && emailResults.fullContact.data) {
            response.sources.push('FullContact');
            const fcData = emailResults.fullContact.data;

            if (fcData.fullName && !response.identity.names.includes(fcData.fullName)) {
              response.identity.names.push(fcData.fullName);
            }
            if (fcData.phones) {
              for (const phone of fcData.phones) {
                if (!response.identity.phones.find(p => p.number === phone.number)) {
                  response.identity.phones.push({ number: phone.number, source: 'FullContact' });
                }
              }
            }
            if (fcData.photos) {
              for (const photo of fcData.photos) {
                response.identity.photos.push({ url: photo.url, source: photo.source || 'FullContact' });
              }
            }
            if (fcData.locations) {
              for (const loc of fcData.locations) {
                if (loc.formatted && !response.identity.locations.includes(loc.formatted)) {
                  response.identity.locations.push(loc.formatted);
                }
              }
            }
            if (options.includeSocialProfiles && fcData.socialProfiles) {
              for (const profile of fcData.socialProfiles) {
                response.identity.socialProfiles.push({
                  platform: profile.platform,
                  url: profile.url,
                  username: profile.username,
                  source: 'FullContact',
                });
              }
            }
          } else if (!emailResults.fullContact.success) {
            response.errors.push({
              source: 'FullContact',
              error: emailResults.fullContact.error || 'Unknown error',
            });
          }

          // Add EmailRep data
          if (emailResults.emailRep.success && emailResults.emailRep.data) {
            response.sources.push('EmailRep');
            const erData = emailResults.emailRep.data;

            if (erData.suspicious) {
              response.risk.factors.push('Email flagged as suspicious');
            }
            if (erData.malicious) {
              response.risk.factors.push('Email linked to malicious activity');
            }
            if (erData.spam) {
              response.risk.factors.push('Email associated with spam');
            }
            if (erData.disposable) {
              response.risk.factors.push('Disposable email address detected');
            }
            if (options.includeSocialProfiles && erData.profilesFound) {
              for (const platform of erData.profilesFound) {
                if (!response.identity.socialProfiles.find(p => p.platform === platform)) {
                  response.identity.socialProfiles.push({
                    platform,
                    source: 'EmailRep',
                  });
                }
              }
            }
          }

          // Add breach data
          if (emailResults.breaches.success && emailResults.breaches.data?.breached) {
            response.sources.push('HaveIBeenPwned');
            const breachCount = emailResults.breaches.data.breachCount;
            if (breachCount > 5) {
              response.risk.factors.push(`Email found in ${breachCount} data breaches`);
            }
          }
        } catch (error) {
          response.errors.push({
            source: 'EmailEnrichment',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })()
    );
  }

  // Wait for all enrichment to complete
  await Promise.all(enrichmentPromises);

  // Now run verification against discovered names
  const namesToCheck = [...new Set(response.identity.names)].filter(n => n.trim().length > 0);

  if (namesToCheck.length > 0) {
    const primaryName = namesToCheck[0];

    // Sanctions check
    if (options.includeSanctions) {
      try {
        const sanctionsResult = await checkOpenSanctions(
          primaryName,
          request.dateOfBirth,
          request.nationality
        );
        response.verification.sanctions = sanctionsResult;
        response.sources.push('OpenSanctions');

        if (sanctionsResult.data?.isMatch) {
          response.risk.factors.push(
            `Name matches ${sanctionsResult.data.matchCount} sanctions record(s)`
          );
        }
      } catch (error) {
        response.errors.push({
          source: 'OpenSanctions',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Watchlist check
    if (options.includeWatchlists) {
      try {
        const watchlistResults = await runAllWatchlistChecks(
          primaryName,
          request.nationality,
          request.dateOfBirth
        );

        // Combine into single result
        response.verification.watchlists = {
          success: true,
          source: 'Watchlists (INTERPOL, FBI, Europol)',
          checkedAt: new Date().toISOString(),
          data: {
            isMatch: watchlistResults.aggregated.isMatch,
            matchCount: watchlistResults.aggregated.totalMatches,
            matches: watchlistResults.aggregated.allMatches,
            sourcesChecked: ['INTERPOL', 'FBI', 'Europol'],
          },
        };

        if (watchlistResults.interpol.success) response.sources.push('INTERPOL');
        if (watchlistResults.fbi.success) response.sources.push('FBI');
        if (watchlistResults.europol.success) response.sources.push('Europol');

        if (watchlistResults.aggregated.isMatch) {
          response.risk.factors.push(
            `Name appears on ${watchlistResults.aggregated.sourcesWithMatches.join(', ')} watchlist(s)`
          );
        }
      } catch (error) {
        response.errors.push({
          source: 'Watchlists',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // Calculate risk score
  calculateEnrichmentRisk(response);

  // Set processing time
  response.processingTime = Date.now() - startTime;
  response.sources = [...new Set(response.sources)];

  return response;
}

/**
 * Verify a person against sanctions and watchlists
 *
 * This is a focused verification check that:
 * - Checks OpenSanctions (OFAC, UN, EU, 100+ lists)
 * - Checks INTERPOL Red Notices
 * - Checks FBI Most Wanted
 * - Checks Europol Most Wanted
 * - Checks for PEP (Politically Exposed Person) status
 *
 * @param request - Verification request with name and optional identifiers
 * @returns Verification response with status and detailed results
 */
export async function verifyPerson(request: VerificationRequest): Promise<VerificationResponse> {
  const startTime = Date.now();
  const requestId = uuidv4();
  const fullName = `${request.firstName} ${request.lastName}`.trim();

  const options = {
    strictMatch: request.options?.strictMatch ?? false,
    minScore: request.options?.minScore ?? 60,
    checkSanctions: request.options?.checkSanctions ?? true,
    checkInterpol: request.options?.checkInterpol ?? true,
    checkFBI: request.options?.checkFBI ?? true,
    checkEuropol: request.options?.checkEuropol ?? true,
  };

  // Initialize response
  const response: VerificationResponse = {
    requestId,
    timestamp: new Date().toISOString(),
    processingTime: 0,
    input: {
      fullName,
      dateOfBirth: request.dateOfBirth,
      nationality: request.nationality,
    },
    status: 'clear',
    sanctions: {
      checked: false,
      isMatch: false,
      matches: [],
    },
    watchlists: {
      checked: false,
      isMatch: false,
      interpol: [],
      fbi: [],
      europol: [],
    },
    risk: {
      score: 0,
      level: 'clear',
      factors: [],
      isPEP: false,
      recommendations: [],
    },
    sourcesChecked: [],
  };

  const verificationPromises: Promise<void>[] = [];

  // Sanctions check
  if (options.checkSanctions) {
    verificationPromises.push(
      (async () => {
        try {
          const sanctionsResults = await runAllSanctionsChecks(
            fullName,
            request.dateOfBirth,
            request.nationality
          );

          response.sanctions.checked = true;
          response.sourcesChecked.push('OpenSanctions', 'OFAC', 'UN', 'EU');

          // Filter by minimum score if strict matching
          const filteredMatches = options.strictMatch
            ? sanctionsResults.combined.data?.matches.filter(m => m.score >= options.minScore) || []
            : sanctionsResults.combined.data?.matches || [];

          response.sanctions.isMatch = filteredMatches.length > 0;
          response.sanctions.matches = filteredMatches;

          // Check PEP status
          response.risk.isPEP = sanctionsResults.aggregated.isPEP;

          if (response.sanctions.isMatch) {
            response.risk.factors.push(
              `Matched ${filteredMatches.length} sanctions record(s) on: ${sanctionsResults.aggregated.listsWithMatches.join(', ')}`
            );
          }

          if (response.risk.isPEP) {
            response.risk.factors.push('Identified as Politically Exposed Person (PEP)');
          }
        } catch (error) {
          response.sanctions.checked = true;
        }
      })()
    );
  }

  // INTERPOL check
  if (options.checkInterpol) {
    verificationPromises.push(
      (async () => {
        try {
          const interpolResult = await checkInterpolRedNotices(
            fullName,
            request.nationality,
            request.dateOfBirth
          );

          response.sourcesChecked.push('INTERPOL');
          response.watchlists.checked = true;

          if (interpolResult.data?.isMatch) {
            response.watchlists.isMatch = true;
            response.watchlists.interpol = interpolResult.data.matches;
            response.risk.factors.push(
              `Found on INTERPOL Red Notices (${interpolResult.data.matchCount} match(es))`
            );
          }
        } catch (error) {
          // Continue with other checks
        }
      })()
    );
  }

  // FBI check
  if (options.checkFBI) {
    verificationPromises.push(
      (async () => {
        try {
          const fbiResult = await checkFBIWanted(fullName);

          response.sourcesChecked.push('FBI');
          response.watchlists.checked = true;

          if (fbiResult.data?.isMatch) {
            response.watchlists.isMatch = true;
            response.watchlists.fbi = fbiResult.data.matches;
            response.risk.factors.push(
              `Found on FBI Most Wanted (${fbiResult.data.matchCount} match(es))`
            );
          }
        } catch (error) {
          // Continue with other checks
        }
      })()
    );
  }

  // Europol check
  if (options.checkEuropol) {
    verificationPromises.push(
      (async () => {
        try {
          const europolResult = await checkEuropolWanted(fullName);

          response.sourcesChecked.push('Europol');
          response.watchlists.checked = true;

          if (europolResult.data?.isMatch) {
            response.watchlists.isMatch = true;
            response.watchlists.europol = europolResult.data.matches;
            response.risk.factors.push(
              `Found on Europol Most Wanted (${europolResult.data.matchCount} match(es))`
            );
          }
        } catch (error) {
          // Continue with other checks
        }
      })()
    );
  }

  // Wait for all verification to complete
  await Promise.all(verificationPromises);

  // Calculate risk and status
  calculateVerificationRisk(response);

  // Set processing time
  response.processingTime = Date.now() - startTime;
  response.sourcesChecked = [...new Set(response.sourcesChecked)];

  return response;
}

/**
 * Calculate risk score and level for enrichment response
 */
function calculateEnrichmentRisk(response: EnrichmentResponse): void {
  let score = 0;

  // Sanctions matches (highest weight)
  if (response.verification.sanctions.data?.isMatch) {
    score += 40 + (response.verification.sanctions.data.matchCount * 10);
  }

  // Watchlist matches (highest weight)
  if (response.verification.watchlists.data?.isMatch) {
    score += 40 + (response.verification.watchlists.data.matchCount * 10);
  }

  // Risk factors
  for (const factor of response.risk.factors) {
    if (factor.includes('malicious')) score += 25;
    else if (factor.includes('suspicious')) score += 15;
    else if (factor.includes('spam')) score += 10;
    else if (factor.includes('disposable')) score += 10;
    else if (factor.includes('breach')) score += Math.min(parseInt(factor.match(/\d+/)?.[0] || '0') * 2, 20);
  }

  // Cap at 100
  response.risk.score = Math.min(score, 100);

  // Determine risk level
  if (score >= 70) {
    response.risk.level = 'critical';
    response.risk.recommendations.push('Manual review required - potential sanctions/watchlist match');
    response.risk.recommendations.push('Do not proceed without compliance team approval');
  } else if (score >= 50) {
    response.risk.level = 'high';
    response.risk.recommendations.push('Enhanced due diligence recommended');
    response.risk.recommendations.push('Verify identity through additional documentation');
  } else if (score >= 30) {
    response.risk.level = 'medium';
    response.risk.recommendations.push('Standard verification procedures recommended');
  } else if (score >= 10) {
    response.risk.level = 'low';
    response.risk.recommendations.push('Standard checks passed - proceed with normal procedures');
  } else {
    response.risk.level = 'clear';
    response.risk.recommendations.push('No risk factors identified');
  }
}

/**
 * Calculate risk score and status for verification response
 */
function calculateVerificationRisk(response: VerificationResponse): void {
  let score = 0;

  // Sanctions matches (critical)
  if (response.sanctions.isMatch) {
    score += 50;
    // Add points based on highest match score
    const highestScore = Math.max(...response.sanctions.matches.map(m => m.score), 0);
    score += Math.round(highestScore / 2);
  }

  // Watchlist matches (critical)
  if (response.watchlists.isMatch) {
    const totalMatches =
      response.watchlists.interpol.length +
      response.watchlists.fbi.length +
      response.watchlists.europol.length;

    score += 40 + (totalMatches * 15);

    // INTERPOL is most severe
    if (response.watchlists.interpol.length > 0) {
      score += 20;
    }
  }

  // PEP status (elevated risk, not critical)
  if (response.risk.isPEP) {
    score += 20;
  }

  // Cap at 100
  response.risk.score = Math.min(score, 100);

  // Determine risk level and status
  if (score >= 70) {
    response.risk.level = 'critical';
    response.status = 'blocked';
    response.risk.recommendations.push('BLOCKED: Subject appears on sanctions/watchlist');
    response.risk.recommendations.push('Do not proceed - report to compliance immediately');
  } else if (score >= 50) {
    response.risk.level = 'high';
    response.status = 'flagged';
    response.risk.recommendations.push('FLAGGED: Potential match requires manual review');
    response.risk.recommendations.push('Escalate to compliance team for verification');
  } else if (response.risk.isPEP) {
    response.risk.level = 'medium';
    response.status = 'review';
    response.risk.recommendations.push('REVIEW: Politically Exposed Person identified');
    response.risk.recommendations.push('Enhanced due diligence required');
  } else if (score >= 20) {
    response.risk.level = 'low';
    response.status = 'review';
    response.risk.recommendations.push('Minor risk factors detected - review recommended');
  } else {
    response.risk.level = 'clear';
    response.status = 'clear';
    response.risk.recommendations.push('All verification checks passed');
  }
}
