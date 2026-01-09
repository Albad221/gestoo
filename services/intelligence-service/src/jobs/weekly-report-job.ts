import { SupabaseClient } from '@supabase/supabase-js';
import { WeeklyReportGenerator } from '../reports/weekly-report';
import { EnforcementReportGenerator } from '../reports/enforcement-report';
import { JobResult, JobError } from '../types';

export class WeeklyReportJob {
  private supabase: SupabaseClient;
  private weeklyReportGenerator: WeeklyReportGenerator;
  private enforcementReportGenerator: EnforcementReportGenerator;
  private jobName = 'weekly-report-generation';

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.weeklyReportGenerator = new WeeklyReportGenerator(supabaseClient);
    this.enforcementReportGenerator = new EnforcementReportGenerator(supabaseClient);
  }

  /**
   * Execute the weekly report generation job
   */
  async execute(): Promise<JobResult> {
    const startTime = new Date();
    const errors: JobError[] = [];
    let recordsProcessed = 0;

    console.log(`[${this.jobName}] Starting weekly report generation...`);

    try {
      // Generate weekly compliance report
      console.log(`[${this.jobName}] Generating weekly compliance report...`);
      const weeklyReport = await this.weeklyReportGenerator.generateReport();
      recordsProcessed++;
      console.log(`[${this.jobName}] Weekly report generated: ${weeklyReport.id}`);

      // Generate enforcement priority report
      console.log(`[${this.jobName}] Generating enforcement priority report...`);
      const enforcementReport = await this.enforcementReportGenerator.generateReport();
      recordsProcessed++;
      console.log(`[${this.jobName}] Enforcement report generated: ${enforcementReport.id}`);

      // Send notifications if critical alerts exist
      const criticalAlerts = weeklyReport.alerts.filter(
        (a) => a.severity === 'critical'
      );

      if (criticalAlerts.length > 0) {
        console.log(
          `[${this.jobName}] ${criticalAlerts.length} critical alert(s) detected`
        );
        await this.sendAlertNotifications(criticalAlerts);
      }

      // Log summary
      const endTime = new Date();
      const result: JobResult = {
        jobId: `${this.jobName}-${startTime.toISOString()}`,
        jobName: this.jobName,
        status: 'success',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        recordsProcessed,
        errors,
      };

      await this.storeJobResult(result);

      console.log(
        `[${this.jobName}] Completed in ${result.duration}ms. Reports generated: ${recordsProcessed}`
      );

      return result;
    } catch (error) {
      const endTime = new Date();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      errors.push({
        timestamp: new Date(),
        message: errorMessage,
      });

      const result: JobResult = {
        jobId: `${this.jobName}-${startTime.toISOString()}`,
        jobName: this.jobName,
        status: 'failed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        recordsProcessed,
        errors,
      };

      await this.storeJobResult(result);

      console.error(`[${this.jobName}] Failed:`, errorMessage);

      return result;
    }
  }

  /**
   * Send notifications for critical alerts
   */
  private async sendAlertNotifications(alerts: any[]): Promise<void> {
    try {
      // Store notifications for delivery
      const notifications = alerts.map((alert) => ({
        type: 'critical_alert',
        title: 'Weekly Report Critical Alert',
        message: alert.message,
        severity: alert.severity,
        category: alert.category,
        created_at: new Date().toISOString(),
        status: 'pending',
      }));

      await this.supabase.from('notifications').insert(notifications);

      console.log(`[${this.jobName}] ${alerts.length} alert notification(s) queued`);
    } catch (error) {
      console.error(`[${this.jobName}] Failed to send notifications:`, error);
    }
  }

  /**
   * Store job result in database
   */
  private async storeJobResult(result: JobResult): Promise<void> {
    try {
      await this.supabase.from('job_history').insert({
        job_id: result.jobId,
        job_name: result.jobName,
        status: result.status,
        start_time: result.startTime.toISOString(),
        end_time: result.endTime.toISOString(),
        duration_ms: result.duration,
        records_processed: result.recordsProcessed,
        errors: result.errors,
      });
    } catch (error) {
      console.error(`[${this.jobName}] Failed to store job result:`, error);
    }
  }
}
