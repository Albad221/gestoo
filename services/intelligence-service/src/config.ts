import { ServiceConfig, JobSchedules } from './types';

export function loadConfig(): ServiceConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY'
    );
  }

  const environment = (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development';
  const port = parseInt(process.env.PORT || '3003', 10);

  const jobSchedules: JobSchedules = {
    dailyRiskUpdate: process.env.DAILY_RISK_UPDATE_SCHEDULE || '0 2 * * *',
    weeklyReport: process.env.WEEKLY_REPORT_SCHEDULE || '0 6 * * 1',
    monthlyTrendAnalysis: process.env.MONTHLY_TREND_ANALYSIS_SCHEDULE || '0 4 1 * *',
  };

  return {
    supabaseUrl,
    supabaseKey,
    port,
    environment,
    jobSchedules,
  };
}

export function isJobSchedulingEnabled(): boolean {
  const enabled = process.env.ENABLE_SCHEDULED_JOBS;
  return enabled !== 'false';
}
