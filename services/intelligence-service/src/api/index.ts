import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { createAnalyticsRouter } from './analytics-routes';
import { createRiskRouter } from './risk-routes';
import { createReportsRouter } from './reports-routes';
import { createEnrichmentRouter } from './enrichment-routes';

export function createApiRouter(supabase: SupabaseClient): Router {
  const router = Router();

  // Mount sub-routers
  router.use('/analytics', createAnalyticsRouter(supabase));
  router.use('/risk', createRiskRouter(supabase));
  router.use('/reports', createReportsRouter(supabase));
  router.use('/intelligence', createEnrichmentRouter(supabase));

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'intelligence-service',
      timestamp: new Date().toISOString(),
    });
  });

  // Service info endpoint
  router.get('/info', (req, res) => {
    res.json({
      name: 'Intelligence Service',
      version: '1.0.0',
      description: 'Advanced analytics and ML-based insights for TPT compliance',
      endpoints: {
        analytics: {
          '/analytics/compliance': 'GET - Compliance metrics and trends',
          '/analytics/revenue': 'GET - Revenue analytics and forecasts',
          '/analytics/revenue/forecast': 'GET - Detailed revenue forecasts',
          '/analytics/hotspots': 'GET - Geographic hotspots',
          '/analytics/hotspots/bounds': 'GET - Hotspots within bounds',
          '/analytics/seasonal': 'GET - Seasonal patterns',
          '/analytics/demand/predict': 'GET - Demand prediction',
        },
        risk: {
          '/risk/landlord/:id': 'GET - Landlord risk score',
          '/risk/landlords': 'GET - All landlord risk scores',
          '/risk/listing/:id': 'GET - Listing risk score',
          '/risk/listings/prioritized': 'GET - Prioritized listings',
          '/risk/area/:city': 'GET - Area risk assessment',
          '/risk/areas/ranked': 'GET - Ranked areas by risk',
          '/risk/refresh/landlords': 'POST - Refresh landlord scores',
          '/risk/refresh/listings': 'POST - Refresh listing scores',
        },
        reports: {
          '/reports/weekly': 'GET - Weekly report',
          '/reports/weekly/:id': 'GET - Specific weekly report',
          '/reports/monthly': 'GET - Monthly report',
          '/reports/enforcement': 'GET - Enforcement report',
          '/reports/enforcement/targets': 'GET - Priority targets',
          '/reports/history': 'GET - Report history',
        },
        intelligence: {
          '/intelligence/enrich': 'POST - Enrich person data from phone, email, or name',
          '/intelligence/verify': 'POST - Verify person against sanctions and watchlists',
          '/intelligence/phone-lookup': 'POST - Direct phone number lookup',
          '/intelligence/email-lookup': 'POST - Direct email lookup and enrichment',
          '/intelligence/sanctions-check': 'POST - Check name against sanctions databases',
          '/intelligence/watchlist-check': 'POST - Check name against law enforcement watchlists',
          '/intelligence/pep-check': 'POST - Check if person is Politically Exposed Person',
          '/intelligence/interpol/:entityId': 'GET - Get INTERPOL notice details',
          '/intelligence/batch-verify': 'POST - Batch verify multiple persons',
        },
      },
    });
  });

  return router;
}

export { createAnalyticsRouter } from './analytics-routes';
export { createRiskRouter } from './risk-routes';
export { createReportsRouter } from './reports-routes';
export { createEnrichmentRouter } from './enrichment-routes';
