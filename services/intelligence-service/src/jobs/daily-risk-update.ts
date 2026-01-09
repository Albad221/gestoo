import { SupabaseClient } from '@supabase/supabase-js';
import { LandlordRiskScorer } from '../risk/landlord-risk';
import { ListingRiskScorer } from '../risk/listing-risk';
import { JobResult, JobError } from '../types';

export class DailyRiskUpdateJob {
  private supabase: SupabaseClient;
  private landlordRiskScorer: LandlordRiskScorer;
  private listingRiskScorer: ListingRiskScorer;
  private jobName = 'daily-risk-update';

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.landlordRiskScorer = new LandlordRiskScorer(supabaseClient);
    this.listingRiskScorer = new ListingRiskScorer(supabaseClient);
  }

  /**
   * Execute the daily risk update job
   */
  async execute(): Promise<JobResult> {
    const startTime = new Date();
    const errors: JobError[] = [];
    let recordsProcessed = 0;

    console.log(`[${this.jobName}] Starting daily risk update...`);

    try {
      // Update landlord risk scores
      console.log(`[${this.jobName}] Updating landlord risk scores...`);
      const landlordResult = await this.landlordRiskScorer.updateAllRiskScores();
      recordsProcessed += landlordResult.processed;

      if (landlordResult.errors > 0) {
        errors.push({
          timestamp: new Date(),
          message: `${landlordResult.errors} landlord(s) failed to update`,
          context: { type: 'landlord', errors: landlordResult.errors },
        });
      }

      console.log(
        `[${this.jobName}] Landlord scores updated: ${landlordResult.processed} processed, ${landlordResult.errors} errors`
      );

      // Update listing risk scores
      console.log(`[${this.jobName}] Updating listing risk scores...`);
      const listingResult = await this.listingRiskScorer.updateAllRiskScores();
      recordsProcessed += listingResult.processed;

      if (listingResult.errors > 0) {
        errors.push({
          timestamp: new Date(),
          message: `${listingResult.errors} listing(s) failed to update`,
          context: { type: 'listing', errors: listingResult.errors },
        });
      }

      console.log(
        `[${this.jobName}] Listing scores updated: ${listingResult.processed} processed, ${listingResult.errors} errors`
      );

      // Log job completion
      const endTime = new Date();
      const result: JobResult = {
        jobId: `${this.jobName}-${startTime.toISOString()}`,
        jobName: this.jobName,
        status: errors.length === 0 ? 'success' : 'partial',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        recordsProcessed,
        errors,
      };

      // Store job result
      await this.storeJobResult(result);

      console.log(
        `[${this.jobName}] Completed in ${result.duration}ms. Processed: ${recordsProcessed}`
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
