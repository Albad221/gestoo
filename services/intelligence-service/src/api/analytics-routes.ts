import { Router, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { ComplianceTrendsAnalyzer } from '../analytics/compliance-trends';
import { RevenueForecastingEngine } from '../analytics/revenue-forecasting';
import { HotspotDetectionEngine } from '../analytics/hotspot-detection';
import { SeasonalPatternAnalyzer } from '../analytics/seasonal-patterns';
import { ApiResponse } from '../types';

export function createAnalyticsRouter(supabase: SupabaseClient): Router {
  const router = Router();

  const complianceAnalyzer = new ComplianceTrendsAnalyzer(supabase);
  const revenueEngine = new RevenueForecastingEngine(supabase);
  const hotspotEngine = new HotspotDetectionEngine(supabase);
  const seasonalAnalyzer = new SeasonalPatternAnalyzer(supabase);

  /**
   * GET /analytics/compliance
   * Get compliance metrics and trends
   */
  router.get('/compliance', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string, 10) || 30;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const metrics = await complianceAnalyzer.getComplianceMetrics({
        startDate,
        endDate,
      });

      const velocity = await complianceAnalyzer.getComplianceVelocity(daysNum);
      const prediction = await complianceAnalyzer.predictComplianceRate(30);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          ...metrics,
          velocity: {
            dailyChange: velocity,
            description: velocity > 0
              ? `Improving ${velocity.toFixed(2)}% per day`
              : `Declining ${Math.abs(velocity).toFixed(2)}% per day`,
          },
          prediction: {
            thirtyDayForecast: prediction,
            confidence: 0.85,
          },
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching compliance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch compliance metrics',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /analytics/revenue
   * Get revenue analytics and forecasts
   */
  router.get('/revenue', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const analytics = await revenueEngine.getRevenueAnalytics(12);

      const response: ApiResponse<any> = {
        success: true,
        data: analytics,
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching revenue analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch revenue analytics',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /analytics/revenue/forecast
   * Get detailed revenue forecasts
   */
  router.get('/revenue/forecast', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { months = '6' } = req.query;
      const monthsNum = parseInt(months as string, 10) || 6;

      const forecasts = await revenueEngine.generateForecasts(monthsNum);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          forecasts,
          generatedAt: new Date(),
          methodology: 'Exponential smoothing with seasonal adjustment',
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error generating forecasts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate revenue forecasts',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /analytics/hotspots
   * Get geographic hotspots of unregistered activity
   */
  router.get('/hotspots', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { city, limit = '50' } = req.query;
      const limitNum = parseInt(limit as string, 10) || 50;

      let hotspots;
      if (city) {
        hotspots = await hotspotEngine.getHotspotsByCity(city as string);
      } else {
        const analytics = await hotspotEngine.getHotspotAnalytics();
        hotspots = analytics.hotspots.slice(0, limitNum);
      }

      const analytics = await hotspotEngine.getHotspotAnalytics();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          hotspots,
          summary: {
            totalHotspots: analytics.hotspots.length,
            totalUnregistered: analytics.totalUnregisteredEstimate,
            totalLostRevenue: analytics.totalLostRevenueEstimate,
          },
          topCities: analytics.topCities.slice(0, 10),
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching hotspots:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch hotspot data',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /analytics/hotspots/bounds
   * Get hotspots within geographic bounds
   */
  router.get('/hotspots/bounds', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { minLat, maxLat, minLon, maxLon } = req.query;

      if (!minLat || !maxLat || !minLon || !maxLon) {
        return res.status(400).json({
          success: false,
          error: 'Missing required bounds parameters (minLat, maxLat, minLon, maxLon)',
        });
      }

      const hotspots = await hotspotEngine.getHotspotsInBounds(
        parseFloat(minLat as string),
        parseFloat(maxLat as string),
        parseFloat(minLon as string),
        parseFloat(maxLon as string)
      );

      const response: ApiResponse<any> = {
        success: true,
        data: { hotspots },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching hotspots by bounds:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch hotspots for bounds',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /analytics/seasonal
   * Get seasonal pattern analysis
   */
  router.get('/seasonal', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { years = '2' } = req.query;
      const yearsNum = parseInt(years as string, 10) || 2;

      const analytics = await seasonalAnalyzer.getSeasonalAnalytics(yearsNum);
      const recommendations = await seasonalAnalyzer.getEnforcementRecommendations();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          ...analytics,
          recommendations,
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching seasonal patterns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch seasonal patterns',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /analytics/demand/predict
   * Predict demand for a specific date
   */
  router.get('/demand/predict', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'Missing required date parameter',
        });
      }

      const targetDate = new Date(date as string);
      const prediction = await seasonalAnalyzer.predictDemand(targetDate);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          date: targetDate,
          predictedOccupancy: prediction,
          confidence: 0.75,
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error predicting demand:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to predict demand',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  return router;
}
