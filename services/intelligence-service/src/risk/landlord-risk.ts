import { SupabaseClient } from '@supabase/supabase-js';
import {
  LandlordRiskScore,
  RiskFactor,
  ComplianceHistoryItem,
} from '../types';

interface LandlordData {
  id: string;
  name: string;
  email: string;
  created_at: string;
  properties_count: number;
  registration_status: string;
  payment_status: string;
}

interface PaymentHistory {
  id: string;
  landlord_id: string;
  amount: number;
  status: string;
  due_date: string;
  paid_date?: string;
}

interface ComplianceEvent {
  id: string;
  landlord_id: string;
  event_type: string;
  event_date: string;
  description: string;
}

export class LandlordRiskScorer {
  private supabase: SupabaseClient;

  // Risk factor weights (should sum to 1.0)
  private readonly WEIGHTS = {
    paymentHistory: 0.25,
    registrationCompliance: 0.20,
    propertyCount: 0.10,
    accountAge: 0.10,
    complianceHistory: 0.20,
    responseTime: 0.15,
  };

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Calculate comprehensive risk score for a landlord
   */
  async calculateRiskScore(landlordId: string): Promise<LandlordRiskScore> {
    const landlord = await this.getLandlordData(landlordId);
    const paymentHistory = await this.getPaymentHistory(landlordId);
    const complianceEvents = await this.getComplianceEvents(landlordId);

    const factors: RiskFactor[] = [];

    // Payment History Factor
    const paymentScore = this.calculatePaymentScore(paymentHistory);
    factors.push({
      name: 'Payment History',
      weight: this.WEIGHTS.paymentHistory,
      score: paymentScore,
      description: this.getPaymentDescription(paymentScore),
    });

    // Registration Compliance Factor
    const registrationScore = this.calculateRegistrationScore(landlord);
    factors.push({
      name: 'Registration Compliance',
      weight: this.WEIGHTS.registrationCompliance,
      score: registrationScore,
      description: this.getRegistrationDescription(registrationScore),
    });

    // Property Count Factor (more properties = more scrutiny needed)
    const propertyScore = this.calculatePropertyCountScore(landlord?.properties_count || 0);
    factors.push({
      name: 'Property Portfolio Size',
      weight: this.WEIGHTS.propertyCount,
      score: propertyScore,
      description: this.getPropertyCountDescription(landlord?.properties_count || 0),
    });

    // Account Age Factor (newer accounts = higher risk)
    const accountAgeScore = this.calculateAccountAgeScore(landlord?.created_at);
    factors.push({
      name: 'Account Age',
      weight: this.WEIGHTS.accountAge,
      score: accountAgeScore,
      description: this.getAccountAgeDescription(accountAgeScore),
    });

    // Compliance History Factor
    const complianceScore = this.calculateComplianceHistoryScore(complianceEvents);
    factors.push({
      name: 'Compliance History',
      weight: this.WEIGHTS.complianceHistory,
      score: complianceScore,
      description: this.getComplianceHistoryDescription(complianceScore),
    });

    // Response Time Factor
    const responseScore = await this.calculateResponseTimeScore(landlordId);
    factors.push({
      name: 'Response Time',
      weight: this.WEIGHTS.responseTime,
      score: responseScore,
      description: this.getResponseTimeDescription(responseScore),
    });

    // Calculate overall weighted score
    const overallScore = factors.reduce(
      (sum, factor) => sum + factor.score * factor.weight,
      0
    );

    const riskLevel = this.determineRiskLevel(overallScore);
    const complianceHistory = this.formatComplianceHistory(complianceEvents);
    const recommendations = this.generateRecommendations(factors, riskLevel);

    return {
      landlordId,
      overallScore,
      riskLevel,
      factors,
      complianceHistory,
      recommendations,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get landlord data from database
   */
  private async getLandlordData(landlordId: string): Promise<LandlordData | null> {
    const { data, error } = await this.supabase
      .from('landlords')
      .select('id, name, email, created_at, properties_count, registration_status, payment_status')
      .eq('id', landlordId)
      .single();

    if (error) {
      console.error('Error fetching landlord:', error);
      return null;
    }

    return data;
  }

  /**
   * Get payment history for a landlord
   */
  private async getPaymentHistory(landlordId: string): Promise<PaymentHistory[]> {
    const { data, error } = await this.supabase
      .from('tpt_payments')
      .select('id, landlord_id, amount, status, due_date, paid_date')
      .eq('landlord_id', landlordId)
      .order('due_date', { ascending: false })
      .limit(24); // Last 2 years of payments

    if (error) {
      console.error('Error fetching payment history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get compliance events for a landlord
   */
  private async getComplianceEvents(landlordId: string): Promise<ComplianceEvent[]> {
    const { data, error } = await this.supabase
      .from('compliance_events')
      .select('id, landlord_id, event_type, event_date, description')
      .eq('landlord_id', landlordId)
      .order('event_date', { ascending: false });

    if (error) {
      console.error('Error fetching compliance events:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Calculate payment history score (0-100, lower = higher risk)
   */
  private calculatePaymentScore(payments: PaymentHistory[]): number {
    if (payments.length === 0) return 50; // Neutral score for no history

    let score = 100;
    const now = new Date();

    payments.forEach((payment) => {
      if (payment.status === 'overdue') {
        const dueDate = new Date(payment.due_date);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Deduct points based on how overdue
        if (daysOverdue > 90) score -= 20;
        else if (daysOverdue > 60) score -= 15;
        else if (daysOverdue > 30) score -= 10;
        else score -= 5;
      } else if (payment.status === 'late') {
        score -= 3; // Minor deduction for late but paid
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate registration compliance score
   */
  private calculateRegistrationScore(landlord: LandlordData | null): number {
    if (!landlord) return 50;

    switch (landlord.registration_status) {
      case 'fully_compliant':
        return 100;
      case 'partially_compliant':
        return 60;
      case 'pending':
        return 40;
      case 'non_compliant':
        return 10;
      default:
        return 50;
    }
  }

  /**
   * Calculate property count risk score
   */
  private calculatePropertyCountScore(count: number): number {
    // More properties = more complexity = slightly higher risk
    if (count >= 20) return 40;
    if (count >= 10) return 55;
    if (count >= 5) return 70;
    if (count >= 1) return 85;
    return 100; // No properties yet
  }

  /**
   * Calculate account age score
   */
  private calculateAccountAgeScore(createdAt?: string): number {
    if (!createdAt) return 50;

    const accountAge = new Date().getTime() - new Date(createdAt).getTime();
    const daysOld = accountAge / (1000 * 60 * 60 * 24);

    // Older accounts with good history = lower risk
    if (daysOld >= 730) return 90; // 2+ years
    if (daysOld >= 365) return 80; // 1+ year
    if (daysOld >= 180) return 65; // 6+ months
    if (daysOld >= 90) return 50;  // 3+ months
    return 35; // New account
  }

  /**
   * Calculate compliance history score
   */
  private calculateComplianceHistoryScore(events: ComplianceEvent[]): number {
    if (events.length === 0) return 70; // Neutral-positive score

    let score = 100;

    events.forEach((event) => {
      switch (event.event_type) {
        case 'violation':
          score -= 15;
          break;
        case 'warning':
          score -= 8;
          break;
        case 'late_registration':
          score -= 5;
          break;
        case 'resolved_issue':
          score += 3; // Positive for resolving issues
          break;
        case 'audit_passed':
          score += 5;
          break;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate response time score
   */
  private async calculateResponseTimeScore(landlordId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('communications')
      .select('sent_at, responded_at')
      .eq('landlord_id', landlordId)
      .not('responded_at', 'is', null)
      .limit(10);

    if (error || !data || data.length === 0) {
      return 70; // Neutral score
    }

    const avgResponseTime = data.reduce((sum, comm) => {
      const sent = new Date(comm.sent_at);
      const responded = new Date(comm.responded_at);
      return sum + (responded.getTime() - sent.getTime());
    }, 0) / data.length;

    const avgHours = avgResponseTime / (1000 * 60 * 60);

    if (avgHours <= 24) return 95;
    if (avgHours <= 48) return 85;
    if (avgHours <= 72) return 70;
    if (avgHours <= 168) return 50; // 1 week
    return 30;
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    // Note: Lower score = higher risk
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'high';
    return 'critical';
  }

  /**
   * Format compliance events into history items
   */
  private formatComplianceHistory(events: ComplianceEvent[]): ComplianceHistoryItem[] {
    return events.map((event) => ({
      date: new Date(event.event_date),
      event: event.description || event.event_type,
      impact: this.getEventImpact(event.event_type),
    }));
  }

  /**
   * Get impact classification for event type
   */
  private getEventImpact(eventType: string): 'positive' | 'negative' | 'neutral' {
    const positiveEvents = ['resolved_issue', 'audit_passed', 'on_time_payment'];
    const negativeEvents = ['violation', 'warning', 'late_registration', 'late_payment'];

    if (positiveEvents.includes(eventType)) return 'positive';
    if (negativeEvents.includes(eventType)) return 'negative';
    return 'neutral';
  }

  /**
   * Generate recommendations based on risk factors
   */
  private generateRecommendations(
    factors: RiskFactor[],
    riskLevel: string
  ): string[] {
    const recommendations: string[] = [];

    factors.forEach((factor) => {
      if (factor.score < 50) {
        switch (factor.name) {
          case 'Payment History':
            recommendations.push(
              'Set up automatic payment reminders or payment plans'
            );
            break;
          case 'Registration Compliance':
            recommendations.push(
              'Ensure all properties are properly registered'
            );
            break;
          case 'Account Age':
            recommendations.push(
              'New accounts require additional verification'
            );
            break;
          case 'Compliance History':
            recommendations.push(
              'Schedule compliance training or consultation'
            );
            break;
          case 'Response Time':
            recommendations.push(
              'Improve communication responsiveness'
            );
            break;
        }
      }
    });

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Consider enhanced monitoring for this landlord');
      recommendations.push('Review account for potential enforcement action');
    }

    return recommendations;
  }

  // Description helpers
  private getPaymentDescription(score: number): string {
    if (score >= 90) return 'Excellent payment history';
    if (score >= 70) return 'Good payment history with minor issues';
    if (score >= 50) return 'Some payment delays noted';
    return 'Significant payment issues detected';
  }

  private getRegistrationDescription(score: number): string {
    if (score >= 90) return 'All properties fully registered';
    if (score >= 60) return 'Most properties registered';
    return 'Registration compliance issues';
  }

  private getPropertyCountDescription(count: number): string {
    if (count >= 20) return `Large portfolio (${count} properties) - requires careful monitoring`;
    if (count >= 10) return `Medium portfolio (${count} properties)`;
    return `Small portfolio (${count} properties)`;
  }

  private getAccountAgeDescription(score: number): string {
    if (score >= 80) return 'Established account with history';
    if (score >= 50) return 'Moderately established account';
    return 'New account - limited history';
  }

  private getComplianceHistoryDescription(score: number): string {
    if (score >= 90) return 'Clean compliance record';
    if (score >= 70) return 'Generally compliant with minor issues';
    if (score >= 50) return 'Some compliance concerns';
    return 'Significant compliance issues';
  }

  private getResponseTimeDescription(score: number): string {
    if (score >= 85) return 'Highly responsive to communications';
    if (score >= 70) return 'Reasonably responsive';
    if (score >= 50) return 'Slow response times';
    return 'Poor communication responsiveness';
  }

  /**
   * Bulk update risk scores for all landlords
   */
  async updateAllRiskScores(): Promise<{ processed: number; errors: number }> {
    const { data: landlords, error } = await this.supabase
      .from('landlords')
      .select('id');

    if (error) {
      console.error('Error fetching landlords:', error);
      return { processed: 0, errors: 1 };
    }

    let processed = 0;
    let errors = 0;

    for (const landlord of landlords || []) {
      try {
        const score = await this.calculateRiskScore(landlord.id);

        // Store the score
        await this.supabase.from('landlord_risk_scores').upsert({
          landlord_id: landlord.id,
          overall_score: score.overallScore,
          risk_level: score.riskLevel,
          factors: score.factors,
          recommendations: score.recommendations,
          updated_at: new Date().toISOString(),
        });

        processed++;
      } catch (err) {
        console.error(`Error processing landlord ${landlord.id}:`, err);
        errors++;
      }
    }

    return { processed, errors };
  }
}
