// Core Types for Intelligence Service

// Time range for analytics queries
export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

// Compliance Types
export interface ComplianceTrend {
  date: Date;
  complianceRate: number;
  totalProperties: number;
  registeredProperties: number;
  unregisteredProperties: number;
  newRegistrations: number;
  deregistrations: number;
}

export interface ComplianceMetrics {
  currentRate: number;
  previousRate: number;
  changePercent: number;
  trends: ComplianceTrend[];
  byCity: CityCompliance[];
  byPropertyType: PropertyTypeCompliance[];
}

export interface CityCompliance {
  city: string;
  complianceRate: number;
  totalProperties: number;
  registeredCount: number;
}

export interface PropertyTypeCompliance {
  propertyType: string;
  complianceRate: number;
  count: number;
}

// Revenue Types
export interface RevenueForecast {
  period: string;
  predictedRevenue: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface RevenueAnalytics {
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  yearToDate: number;
  projectedAnnual: number;
  growthRate: number;
  forecasts: RevenueForecast[];
  byCity: CityRevenue[];
}

export interface CityRevenue {
  city: string;
  revenue: number;
  percentOfTotal: number;
  growth: number;
}

// Hotspot Types
export interface Hotspot {
  id: string;
  latitude: number;
  longitude: number;
  city: string;
  neighborhood: string;
  unregisteredCount: number;
  estimatedLostRevenue: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: Date;
}

export interface HotspotAnalytics {
  hotspots: Hotspot[];
  totalUnregisteredEstimate: number;
  totalLostRevenueEstimate: number;
  topCities: CityHotspot[];
}

export interface CityHotspot {
  city: string;
  hotspotCount: number;
  unregisteredEstimate: number;
  lostRevenueEstimate: number;
}

// Seasonal Pattern Types
export interface SeasonalPattern {
  month: number;
  monthName: string;
  averageOccupancy: number;
  averageBookings: number;
  revenueIndex: number;
  isHighSeason: boolean;
}

export interface SeasonalAnalytics {
  patterns: SeasonalPattern[];
  peakMonths: number[];
  lowMonths: number[];
  seasonalityIndex: number;
  yearOverYearTrend: number;
}

// Risk Scoring Types
export interface LandlordRiskScore {
  landlordId: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  complianceHistory: ComplianceHistoryItem[];
  recommendations: string[];
  lastUpdated: Date;
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface ComplianceHistoryItem {
  date: Date;
  event: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface ListingRiskScore {
  listingId: string;
  sourceUrl: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  investigationPriority: number;
  factors: RiskFactor[];
  matchedLandlord?: string;
  estimatedRevenue: number;
  recommendations: string[];
}

export interface AreaRiskAssessment {
  city: string;
  neighborhood?: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceRate: number;
  unregisteredEstimate: number;
  enforcementPriority: number;
  factors: RiskFactor[];
  trends: AreaTrend[];
  recommendations: string[];
}

export interface AreaTrend {
  date: Date;
  metric: string;
  value: number;
  change: number;
}

// Report Types
export interface WeeklyReport {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  generatedAt: Date;
  summary: ReportSummary;
  complianceMetrics: ComplianceMetrics;
  revenueHighlights: RevenueHighlights;
  enforcementActions: EnforcementAction[];
  alerts: Alert[];
}

export interface MonthlyReport {
  id: string;
  month: number;
  year: number;
  generatedAt: Date;
  summary: ReportSummary;
  complianceMetrics: ComplianceMetrics;
  revenueAnalytics: RevenueAnalytics;
  hotspotAnalysis: HotspotAnalytics;
  seasonalInsights: SeasonalAnalytics;
  riskAssessment: RiskAssessmentSummary;
  recommendations: Recommendation[];
}

export interface EnforcementReport {
  id: string;
  generatedAt: Date;
  priorityTargets: EnforcementTarget[];
  byCity: CityEnforcementSummary[];
  resourceAllocation: ResourceRecommendation[];
  expectedOutcome: EnforcementOutcome;
}

export interface ReportSummary {
  headline: string;
  keyMetrics: KeyMetric[];
  highlights: string[];
  concerns: string[];
}

export interface KeyMetric {
  name: string;
  value: number;
  unit: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export interface RevenueHighlights {
  collected: number;
  projected: number;
  outstanding: number;
  collectionRate: number;
}

export interface EnforcementAction {
  id: string;
  type: string;
  target: string;
  status: string;
  outcome?: string;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  category: string;
  actionRequired: boolean;
}

export interface RiskAssessmentSummary {
  highRiskLandlords: number;
  highRiskListings: number;
  highRiskAreas: number;
  totalRiskScore: number;
}

export interface Recommendation {
  id: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  title: string;
  description: string;
  expectedImpact: string;
}

export interface EnforcementTarget {
  id: string;
  type: 'landlord' | 'listing' | 'area';
  name: string;
  city: string;
  riskScore: number;
  estimatedLostRevenue: number;
  priority: number;
  recommendedAction: string;
}

export interface CityEnforcementSummary {
  city: string;
  targetCount: number;
  estimatedRecovery: number;
  resourcesNeeded: number;
}

export interface ResourceRecommendation {
  city: string;
  inspectorsNeeded: number;
  estimatedHours: number;
  priority: number;
}

export interface EnforcementOutcome {
  estimatedRecovery: number;
  newRegistrationsExpected: number;
  complianceRateIncrease: number;
}

// Job Types
export interface JobResult {
  jobId: string;
  jobName: string;
  status: 'success' | 'failed' | 'partial';
  startTime: Date;
  endTime: Date;
  duration: number;
  recordsProcessed: number;
  errors: JobError[];
}

export interface JobError {
  timestamp: Date;
  message: string;
  context?: Record<string, unknown>;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: Date;
    processingTime: number;
    cached?: boolean;
  };
}

// Configuration Types
export interface ServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
  port: number;
  environment: 'development' | 'staging' | 'production';
  jobSchedules: JobSchedules;
}

export interface JobSchedules {
  dailyRiskUpdate: string;
  weeklyReport: string;
  monthlyTrendAnalysis: string;
}
