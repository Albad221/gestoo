import { Router, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { LandlordRiskScorer } from '../risk/landlord-risk';
import { ListingRiskScorer } from '../risk/listing-risk';
import { AreaRiskAssessor } from '../risk/area-risk';
import { ApiResponse } from '../types';

export function createRiskRouter(supabase: SupabaseClient): Router {
  const router = Router();

  const landlordRiskScorer = new LandlordRiskScorer(supabase);
  const listingRiskScorer = new ListingRiskScorer(supabase);
  const areaRiskAssessor = new AreaRiskAssessor(supabase);

  /**
   * GET /risk/landlord/:id
   * Get risk score for a specific landlord
   */
  router.get('/landlord/:id', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Landlord ID is required',
        });
      }

      const riskScore = await landlordRiskScorer.calculateRiskScore(id);

      const response: ApiResponse<any> = {
        success: true,
        data: riskScore,
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error calculating landlord risk:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate landlord risk score',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /risk/landlords
   * Get all landlords with risk scores, optionally filtered by risk level
   */
  router.get('/landlords', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { riskLevel, limit = '50' } = req.query;
      const limitNum = parseInt(limit as string, 10) || 50;

      let query = supabase
        .from('landlord_risk_scores')
        .select('*')
        .order('overall_score', { ascending: true })
        .limit(limitNum);

      if (riskLevel) {
        query = query.eq('risk_level', riskLevel);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const response: ApiResponse<any> = {
        success: true,
        data: {
          landlords: data || [],
          count: data?.length || 0,
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching landlord risks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch landlord risk scores',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /risk/listing/:id
   * Get risk score for a specific listing
   */
  router.get('/listing/:id', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Listing ID is required',
        });
      }

      const riskScore = await listingRiskScorer.calculateRiskScore(id);

      const response: ApiResponse<any> = {
        success: true,
        data: riskScore,
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error calculating listing risk:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate listing risk score',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /risk/listings/prioritized
   * Get prioritized list of listings for investigation
   */
  router.get('/listings/prioritized', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { limit = '50' } = req.query;
      const limitNum = parseInt(limit as string, 10) || 50;

      const prioritizedListings = await listingRiskScorer.getPrioritizedListings(limitNum);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          listings: prioritizedListings,
          count: prioritizedListings.length,
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching prioritized listings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch prioritized listings',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /risk/area/:city
   * Get risk assessment for a specific city
   */
  router.get('/area/:city', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { city } = req.params;
      const { neighborhood } = req.query;

      if (!city) {
        return res.status(400).json({
          success: false,
          error: 'City is required',
        });
      }

      const assessment = await areaRiskAssessor.assessAreaRisk(
        city,
        neighborhood as string | undefined
      );

      const response: ApiResponse<any> = {
        success: true,
        data: assessment,
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error assessing area risk:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assess area risk',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /risk/areas/ranked
   * Get all areas ranked by risk
   */
  router.get('/areas/ranked', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { limit = '20' } = req.query;
      const limitNum = parseInt(limit as string, 10) || 20;

      const rankedAreas = await areaRiskAssessor.getRankedCities();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          areas: rankedAreas.slice(0, limitNum),
          count: rankedAreas.length,
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching ranked areas:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ranked areas',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * POST /risk/refresh/landlords
   * Trigger bulk update of landlord risk scores
   */
  router.post('/refresh/landlords', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const result = await landlordRiskScorer.updateAllRiskScores();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          message: 'Landlord risk scores updated',
          processed: result.processed,
          errors: result.errors,
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error refreshing landlord risks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh landlord risk scores',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * POST /risk/refresh/listings
   * Trigger bulk update of listing risk scores
   */
  router.post('/refresh/listings', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const result = await listingRiskScorer.updateAllRiskScores();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          message: 'Listing risk scores updated',
          processed: result.processed,
          errors: result.errors,
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error refreshing listing risks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh listing risk scores',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  return router;
}
