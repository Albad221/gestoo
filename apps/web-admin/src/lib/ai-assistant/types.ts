export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: QueryResult;
  isLoading?: boolean;
}

export interface QueryResult {
  type: 'count' | 'list' | 'details' | 'stats' | 'table';
  title?: string;
  value?: number | string;
  items?: Record<string, unknown>[];
  columns?: string[];
}

export interface FunctionCall {
  function: string;
  params: Record<string, unknown>;
}

export interface ChatRequest {
  message: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface ChatResponse {
  response: string;
  data?: QueryResult;
  error?: string;
}

// Parameter types for query functions
export interface CountPropertiesParams {
  type?: string;
  city?: string;
  region?: string;
  status?: string;
}

export interface CountScrapedListingsParams {
  platform?: string;
  city?: string;
  is_compliant?: boolean;
}

export interface GetPropertyDetailsParams {
  name?: string;
  id?: string;
}

export interface GetGuestCountParams {
  property_id?: string;
  property_name?: string;
  date?: string;
  period?: 'today' | 'week' | 'month' | 'year';
}

export interface GetTaxLiabilityParams {
  property_id?: string;
  property_name?: string;
  period?: 'month' | 'quarter' | 'year';
}

export interface GetRevenueStatsParams {
  city?: string;
  region?: string;
  period?: 'today' | 'week' | 'month' | 'year';
}

export interface GetOccupancyRateParams {
  city?: string;
  property_id?: string;
  period?: 'week' | 'month' | 'year';
}

export interface GetNonDeclarersParams {
  days_since_declaration?: number;
  city?: string;
}

export interface GetAlertsSummaryParams {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'open' | 'investigating' | 'resolved';
}

export interface SearchPropertiesParams {
  query: string;
  city?: string;
  type?: string;
}
