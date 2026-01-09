import cron from 'node-cron';
import { SupabaseClient } from '@supabase/supabase-js';
import { DailyRiskUpdateJob } from './daily-risk-update';
import { WeeklyReportJob } from './weekly-report-job';
import { MonthlyTrendAnalysisJob } from './monthly-trend-analysis';

export { DailyRiskUpdateJob } from './daily-risk-update';
export { WeeklyReportJob } from './weekly-report-job';
export { MonthlyTrendAnalysisJob } from './monthly-trend-analysis';

export interface ScheduledJob {
  name: string;
  schedule: string;
  task: cron.ScheduledTask;
  enabled: boolean;
}

export class JobScheduler {
  private supabase: SupabaseClient;
  private jobs: Map<string, ScheduledJob> = new Map();

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Initialize all scheduled jobs
   */
  initialize(schedules?: {
    dailyRiskUpdate?: string;
    weeklyReport?: string;
    monthlyTrendAnalysis?: string;
  }): void {
    const defaultSchedules = {
      dailyRiskUpdate: '0 2 * * *',      // Daily at 2 AM
      weeklyReport: '0 6 * * 1',          // Monday at 6 AM
      monthlyTrendAnalysis: '0 4 1 * *',  // 1st of month at 4 AM
    };

    const finalSchedules = { ...defaultSchedules, ...schedules };

    // Schedule daily risk update
    this.scheduleJob(
      'daily-risk-update',
      finalSchedules.dailyRiskUpdate,
      async () => {
        const job = new DailyRiskUpdateJob(this.supabase);
        await job.execute();
      }
    );

    // Schedule weekly report
    this.scheduleJob(
      'weekly-report',
      finalSchedules.weeklyReport,
      async () => {
        const job = new WeeklyReportJob(this.supabase);
        await job.execute();
      }
    );

    // Schedule monthly trend analysis
    this.scheduleJob(
      'monthly-trend-analysis',
      finalSchedules.monthlyTrendAnalysis,
      async () => {
        const job = new MonthlyTrendAnalysisJob(this.supabase);
        await job.execute();
      }
    );

    console.log('[JobScheduler] All jobs initialized');
    this.listJobs();
  }

  /**
   * Schedule a single job
   */
  private scheduleJob(
    name: string,
    schedule: string,
    callback: () => Promise<void>
  ): void {
    if (!cron.validate(schedule)) {
      console.error(`[JobScheduler] Invalid cron schedule for ${name}: ${schedule}`);
      return;
    }

    const task = cron.schedule(schedule, async () => {
      console.log(`[JobScheduler] Executing job: ${name}`);
      try {
        await callback();
      } catch (error) {
        console.error(`[JobScheduler] Job ${name} failed:`, error);
      }
    });

    this.jobs.set(name, {
      name,
      schedule,
      task,
      enabled: true,
    });

    console.log(`[JobScheduler] Scheduled job: ${name} (${schedule})`);
  }

  /**
   * Start all scheduled jobs
   */
  startAll(): void {
    this.jobs.forEach((job, name) => {
      job.task.start();
      job.enabled = true;
      console.log(`[JobScheduler] Started job: ${name}`);
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll(): void {
    this.jobs.forEach((job, name) => {
      job.task.stop();
      job.enabled = false;
      console.log(`[JobScheduler] Stopped job: ${name}`);
    });
  }

  /**
   * Start a specific job
   */
  startJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      console.error(`[JobScheduler] Job not found: ${name}`);
      return false;
    }

    job.task.start();
    job.enabled = true;
    console.log(`[JobScheduler] Started job: ${name}`);
    return true;
  }

  /**
   * Stop a specific job
   */
  stopJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      console.error(`[JobScheduler] Job not found: ${name}`);
      return false;
    }

    job.task.stop();
    job.enabled = false;
    console.log(`[JobScheduler] Stopped job: ${name}`);
    return true;
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(name: string): Promise<boolean> {
    console.log(`[JobScheduler] Manually triggering job: ${name}`);

    try {
      switch (name) {
        case 'daily-risk-update': {
          const job = new DailyRiskUpdateJob(this.supabase);
          await job.execute();
          return true;
        }
        case 'weekly-report': {
          const job = new WeeklyReportJob(this.supabase);
          await job.execute();
          return true;
        }
        case 'monthly-trend-analysis': {
          const job = new MonthlyTrendAnalysisJob(this.supabase);
          await job.execute();
          return true;
        }
        default:
          console.error(`[JobScheduler] Unknown job: ${name}`);
          return false;
      }
    } catch (error) {
      console.error(`[JobScheduler] Failed to trigger job ${name}:`, error);
      return false;
    }
  }

  /**
   * List all scheduled jobs
   */
  listJobs(): ScheduledJob[] {
    const jobList = Array.from(this.jobs.values());

    console.log('[JobScheduler] Scheduled jobs:');
    jobList.forEach((job) => {
      console.log(`  - ${job.name}: ${job.schedule} (${job.enabled ? 'enabled' : 'disabled'})`);
    });

    return jobList;
  }

  /**
   * Get job status
   */
  getJobStatus(name: string): ScheduledJob | undefined {
    return this.jobs.get(name);
  }

  /**
   * Get all job statuses
   */
  getAllJobStatuses(): Record<string, { schedule: string; enabled: boolean }> {
    const statuses: Record<string, { schedule: string; enabled: boolean }> = {};

    this.jobs.forEach((job, name) => {
      statuses[name] = {
        schedule: job.schedule,
        enabled: job.enabled,
      };
    });

    return statuses;
  }
}
