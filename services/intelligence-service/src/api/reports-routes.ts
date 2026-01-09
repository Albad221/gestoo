import { Router, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { WeeklyReportGenerator } from '../reports/weekly-report';
import { MonthlyReportGenerator } from '../reports/monthly-report';
import { EnforcementReportGenerator } from '../reports/enforcement-report';
import { ApiResponse } from '../types';

export function createReportsRouter(supabase: SupabaseClient): Router {
  const router = Router();

  const weeklyReportGenerator = new WeeklyReportGenerator(supabase);
  const monthlyReportGenerator = new MonthlyReportGenerator(supabase);
  const enforcementReportGenerator = new EnforcementReportGenerator(supabase);

  /**
   * GET /reports/weekly
   * Generate or retrieve weekly report
   */
  router.get('/weekly', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { generate = 'false' } = req.query;

      let report;
      if (generate === 'true') {
        report = await weeklyReportGenerator.generateReport();
      } else {
        report = await weeklyReportGenerator.getLatestReport();

        if (!report) {
          // Generate if none exists
          report = await weeklyReportGenerator.generateReport();
        }
      }

      const response: ApiResponse<any> = {
        success: true,
        data: report,
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
          cached: generate !== 'true',
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error with weekly report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get weekly report',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /reports/weekly/:id
   * Get specific weekly report by ID
   */
  router.get('/weekly/:id', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { id } = req.params;
      const report = await weeklyReportGenerator.getReportById(id);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found',
        });
      }

      const response: ApiResponse<any> = {
        success: true,
        data: report,
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching weekly report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch weekly report',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /reports/monthly
   * Generate or retrieve monthly report
   */
  router.get('/monthly', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { generate = 'false', month, year } = req.query;

      let report;
      if (generate === 'true') {
        const monthNum = month ? parseInt(month as string, 10) - 1 : undefined;
        const yearNum = year ? parseInt(year as string, 10) : undefined;
        report = await monthlyReportGenerator.generateReport(monthNum, yearNum);
      } else {
        if (month && year) {
          const monthNum = parseInt(month as string, 10) - 1;
          const yearNum = parseInt(year as string, 10);
          report = await monthlyReportGenerator.getReportByMonth(monthNum, yearNum);
        } else {
          report = await monthlyReportGenerator.getLatestReport();
        }

        if (!report) {
          // Generate if none exists
          report = await monthlyReportGenerator.generateReport();
        }
      }

      const response: ApiResponse<any> = {
        success: true,
        data: report,
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
          cached: generate !== 'true',
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error with monthly report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get monthly report',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /reports/enforcement
   * Generate or retrieve enforcement priority report
   */
  router.get('/enforcement', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { generate = 'false' } = req.query;

      let report;
      if (generate === 'true') {
        report = await enforcementReportGenerator.generateReport();
      } else {
        report = await enforcementReportGenerator.getLatestReport();

        if (!report) {
          report = await enforcementReportGenerator.generateReport();
        }
      }

      const response: ApiResponse<any> = {
        success: true,
        data: report,
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
          cached: generate !== 'true',
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error with enforcement report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get enforcement report',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /reports/enforcement/targets
   * Get top priority enforcement targets
   */
  router.get('/enforcement/targets', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { limit = '10', city } = req.query;
      const limitNum = parseInt(limit as string, 10) || 10;

      let targets;
      if (city) {
        targets = await enforcementReportGenerator.getTargetsByCity(city as string);
      } else {
        targets = await enforcementReportGenerator.getTopPriorityTargets(limitNum);
      }

      const response: ApiResponse<any> = {
        success: true,
        data: {
          targets,
          count: targets.length,
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching enforcement targets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch enforcement targets',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  /**
   * GET /reports/history
   * Get list of all generated reports
   */
  router.get('/history', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { type, limit = '20' } = req.query;
      const limitNum = parseInt(limit as string, 10) || 20;

      const reports: any[] = [];

      if (!type || type === 'weekly') {
        const { data: weeklyReports } = await supabase
          .from('weekly_reports')
          .select('id, week_start, week_end, generated_at')
          .order('generated_at', { ascending: false })
          .limit(limitNum);

        if (weeklyReports) {
          reports.push(
            ...weeklyReports.map((r) => ({
              ...r,
              type: 'weekly',
            }))
          );
        }
      }

      if (!type || type === 'monthly') {
        const { data: monthlyReports } = await supabase
          .from('monthly_reports')
          .select('id, month, year, generated_at')
          .order('generated_at', { ascending: false })
          .limit(limitNum);

        if (monthlyReports) {
          reports.push(
            ...monthlyReports.map((r) => ({
              ...r,
              type: 'monthly',
            }))
          );
        }
      }

      if (!type || type === 'enforcement') {
        const { data: enforcementReports } = await supabase
          .from('enforcement_reports')
          .select('id, generated_at')
          .order('generated_at', { ascending: false })
          .limit(limitNum);

        if (enforcementReports) {
          reports.push(
            ...enforcementReports.map((r) => ({
              ...r,
              type: 'enforcement',
            }))
          );
        }
      }

      // Sort by date
      reports.sort(
        (a, b) =>
          new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
      );

      const response: ApiResponse<any> = {
        success: true,
        data: {
          reports: reports.slice(0, limitNum),
          count: reports.length,
        },
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching report history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch report history',
        meta: {
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    }
  });

  return router;
}
