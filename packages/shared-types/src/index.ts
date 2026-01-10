// ============================================
// ENUMS
// ============================================

export type PropertyType = 'hotel' | 'meuble' | 'guesthouse' | 'short_term';

export type PropertyStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export type DocumentType = 'cni' | 'passport' | 'cedeao_id' | 'residence_permit';

export type StayStatus = 'active' | 'completed' | 'cancelled';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export type PaymentMethod = 'wave' | 'orange_money' | 'card' | 'cash';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export type AlertStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed';

export type UserRole = 'landlord' | 'police' | 'ministry' | 'tax_authority' | 'admin';

// ============================================
// DATABASE MODELS
// ============================================

export interface Landlord {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  cni_number: string | null;
  cni_photo_url: string | null;
  business_name: string | null;
  ninea_number: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  verified: boolean;
  verified_at: string | null;
  verification_notes: string | null;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  landlord_id: string;
  name: string;
  type: PropertyType;
  description: string | null;
  address: string;
  city: string;
  region: string;
  gps_lat: number | null;
  gps_lng: number | null;
  license_number: string | null;
  status: PropertyStatus;
  capacity_rooms: number | null;
  capacity_beds: number | null;
  capacity_guests: number | null;
  amenities: string[];
  compliance_score: number;
  last_inspection_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyPhoto {
  id: string;
  property_id: string;
  storage_path: string;
  url: string | null;
  is_primary: boolean;
  caption: string | null;
  created_at: string;
}

export interface PropertyDocument {
  id: string;
  property_id: string;
  document_type: string;
  storage_path: string;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  document_type: DocumentType | null;
  document_number: string | null;
  document_photo_url: string | null;
  document_expiry: string | null;
  document_verified: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stay {
  id: string;
  property_id: string;
  guest_id: string;
  guardian_id: string | null;
  check_in: string;
  check_out: string | null;
  expected_check_out: string | null;
  nights: number | null;
  num_guests: number;
  room_number: string | null;
  status: StayStatus;
  purpose: string | null;
  notes: string | null;
  police_notified: boolean;
  police_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxLiability {
  id: string;
  property_id: string;
  landlord_id: string;
  stay_id: string | null;
  period_start: string | null;
  period_end: string | null;
  guest_nights: number;
  rate_per_night: number;
  amount: number;
  paid_amount: number;
  status: PaymentStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  landlord_id: string;
  tax_liability_id: string | null;
  amount: number;
  currency: string;
  method: PaymentMethod;
  provider_reference: string | null;
  provider_transaction_id: string | null;
  status: PaymentStatus;
  receipt_number: string | null;
  receipt_url: string | null;
  treasury_settled: boolean;
  treasury_settled_at: string | null;
  treasury_reference: string | null;
  metadata: Record<string, unknown> | null;
  initiated_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: string;
  title: string;
  description: string | null;
  property_id: string | null;
  landlord_id: string | null;
  guest_id: string | null;
  stay_id: string | null;
  status: AlertStatus;
  assigned_to: string | null;
  jurisdiction: string | null;
  metadata: Record<string, unknown> | null;
  auto_generated: boolean;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export interface ScrapedListing {
  id: string;
  platform: string;
  external_id: string;
  url: string;
  title: string | null;
  description: string | null;
  property_type: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  price_per_night: number | null;
  currency: string;
  capacity_guests: number | null;
  capacity_bedrooms: number | null;
  capacity_bathrooms: number | null;
  host_name: string | null;
  host_id: string | null;
  host_url: string | null;
  rating: number | null;
  review_count: number | null;
  photos: string[] | null;
  amenities: string[] | null;
  calendar_data: Record<string, unknown> | null;
  estimated_occupancy: number | null;
  estimated_revenue: number | null;
  is_active: boolean;
  first_seen_at: string;
  last_scraped_at: string;
  scrape_count: number;
}

export interface ListingMatch {
  id: string;
  scraped_listing_id: string;
  property_id: string | null;
  confidence: number | null;
  match_type: string | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  rejected: boolean;
  rejection_reason: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_role: UserRole | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// API TYPES
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// AUTH TYPES
// ============================================

export interface AuthUser {
  id: string;
  phone: string;
  email?: string;
  role: UserRole;
  landlord_id?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

// ============================================
// FORM / INPUT TYPES
// ============================================

export interface CreateLandlordInput {
  full_name: string;
  phone: string;
  email?: string;
  cni_number?: string;
  business_name?: string;
  ninea_number?: string;
  address?: string;
  city?: string;
  region?: string;
  preferred_language?: string;
}

export interface CreatePropertyInput {
  name: string;
  type: PropertyType;
  description?: string;
  address: string;
  city: string;
  region: string;
  gps_lat?: number;
  gps_lng?: number;
  capacity_rooms?: number;
  capacity_beds?: number;
  capacity_guests?: number;
  amenities?: string[];
}

export interface CreateGuestInput {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  nationality?: string;
  document_type?: DocumentType;
  document_number?: string;
  document_expiry?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface CreateStayInput {
  property_id: string;
  guest_id: string;
  guardian_id?: string;
  expected_check_out?: string;
  num_guests?: number;
  room_number?: string;
  purpose?: string;
  notes?: string;
}

export interface CheckOutInput {
  stay_id: string;
  notes?: string;
}

export interface InitiatePaymentInput {
  landlord_id: string;
  tax_liability_id?: string;
  amount: number;
  method: PaymentMethod;
}

// ============================================
// WHATSAPP CHATBOT TYPES
// ============================================

export type ChatbotState =
  | 'IDLE'
  | 'ONBOARDING_START'
  | 'ONBOARDING_NAME'
  | 'ONBOARDING_CNI'
  | 'ONBOARDING_CNI_PHOTO'
  | 'ONBOARDING_CONFIRM'
  | 'ADD_PROPERTY_START'
  | 'ADD_PROPERTY_NAME'
  | 'ADD_PROPERTY_TYPE'
  | 'ADD_PROPERTY_ADDRESS'
  | 'ADD_PROPERTY_LOCATION'
  | 'ADD_PROPERTY_PHOTOS'
  | 'ADD_PROPERTY_CONFIRM'
  | 'GUEST_CHECKIN_START'
  | 'GUEST_CHECKIN_PROPERTY'
  | 'GUEST_CHECKIN_DOCUMENT'
  | 'GUEST_CHECKIN_CONFIRM_DATA'
  | 'GUEST_CHECKIN_CONFIRM'
  | 'GUEST_CHECKIN_MANUAL_NAME'
  | 'GUEST_CHECKIN_MANUAL_DOC_TYPE'
  | 'GUEST_CHECKIN_MANUAL_DOC_NUM'
  | 'GUEST_CHECKIN_MANUAL_NATIONALITY'
  | 'GUEST_CHECKIN_MANUAL_DOB'
  | 'GUEST_CHECKIN_GUARDIAN'
  | 'GUEST_CHECKIN_GUARDIAN_PHONE'
  | 'GUEST_CHECKIN_NIGHTS'
  | 'GUEST_CHECKIN_NUM_GUESTS'
  | 'GUEST_CHECKOUT_SELECT'
  | 'GUEST_CHECKOUT_CONFIRM'
  | 'PAY_TPT_VIEW'
  | 'PAY_TPT_METHOD'
  | 'PAY_TPT_CONFIRM'
  | 'PAY_TPT_PENDING'
  | 'VIEW_HISTORY'
  | 'VIEW_BALANCE'
  | 'HELP';

export interface ChatbotSession {
  id?: string;
  phone: string;
  state: ChatbotState;
  landlord_id?: string;
  property_id?: string;
  guest_id?: string;
  stay_id?: string;
  data: Record<string, unknown>;
  last_activity: string;
  language: 'fr' | 'wo' | 'en';
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'location' | 'interactive' | 'button' | 'video' | 'audio' | 'sticker' | 'contacts' | 'voice' | 'reaction' | 'order' | 'catalog' | 'media_placeholder';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256?: string };
  document?: { id: string; mime_type: string; sha256?: string; filename: string };
  video?: { id: string; mime_type: string; sha256?: string };
  audio?: { id: string; mime_type: string; sha256?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  total_properties: number;
  active_properties: number;
  pending_properties: number;
  total_guests_today: number;
  total_revenue_month: number;
  outstanding_tpt: number;
  active_alerts: number;
  compliance_rate: number;
}

export interface MapProperty {
  id: string;
  name: string;
  type: PropertyType;
  status: PropertyStatus;
  gps_lat: number;
  gps_lng: number;
  compliance_score: number;
  active_guests: number;
  has_alerts: boolean;
  landlord_name: string;
}

export interface AlertWithDetails extends Alert {
  property?: Property;
  landlord?: Landlord;
  guest?: Guest;
}

// ============================================
// SENEGAL REGIONS
// ============================================

export const SENEGAL_REGIONS = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kédougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sédhiou',
  'Tambacounda',
  'Thiès',
  'Ziguinchor',
] as const;

export type SenegalRegion = (typeof SENEGAL_REGIONS)[number];

// ============================================
// CONSTANTS
// ============================================

export const TPT_RATE_PER_NIGHT = 1000; // FCFA
export const CURRENCY = 'XOF';
export const MIN_GUARDIAN_AGE = 21;
export const MINOR_AGE = 18;

// ============================================
// GESTOO CHECK-IN APP TYPES
// ============================================

// Property Staff Role
export type PropertyStaffRole = 'manager' | 'receptionist' | 'viewer';

// Police Form Status
export type PoliceFormStatus = 'draft' | 'completed' | 'submitted' | 'cancelled';

// Police Document Type (for fiche de police)
export type PoliceDocumentType =
  | 'passport'
  | 'cni'
  | 'titre_sejour'
  | 'cedeao_id'
  | 'permis_conduire'
  | 'other';

// Travel Motive (motif du voyage)
export type TravelMotive =
  | 'tourisme'
  | 'affaires'
  | 'famille'
  | 'etudes'
  | 'travail'
  | 'sante'
  | 'conference'
  | 'transit'
  | 'autre';

// Verification Status
export type VerificationStatus = 'pending' | 'verified' | 'flagged' | 'rejected';

// Risk Level
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Sync Operation
export type SyncOperation = 'create' | 'update' | 'delete';

// Sync Status
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';

// Sync Resolution
export type SyncResolution = 'client_wins' | 'server_wins' | 'merge' | 'manual';

// Property Staff - Hotel/Property employees who can use the check-in app
export interface PropertyStaff {
  id: string;
  user_id: string | null;
  property_id: string;
  landlord_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  role: PropertyStaffRole;
  permissions: string[];
  badge_number: string | null;
  shift: 'day' | 'night' | 'all' | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// Police Form - Full fiche de police data
export interface PoliceForm {
  id: string;
  property_id: string;
  guest_id: string | null;
  stay_id: string | null;
  created_by: string | null;
  form_number: string | null;

  // Identity Section
  nom: string;
  nom_jeune_fille: string | null;
  prenoms: string;
  date_naissance: string;
  lieu_naissance: string;
  pays_departement: string;
  nationalite: string;
  sexe: 'M' | 'F' | null;

  // Document Section
  type_piece: PoliceDocumentType;
  numero_piece: string;
  date_delivrance: string | null;
  lieu_delivrance: string | null;
  autorite_delivrance: string | null;
  date_expiration: string | null;
  document_photo_url: string | null;
  document_verified: boolean;

  // Stay Information Section
  date_entree_senegal: string | null;
  profession: string | null;
  domicile_habituel: string | null;
  email: string | null;
  telephone: string | null;
  provenance: string | null;
  destination: string | null;
  motif_voyage: TravelMotive | null;
  motif_voyage_autre: string | null;
  nb_enfants_moins_15: number;
  immatriculation_vehicule: string | null;

  // Establishment Section
  date_entree: string;
  heure_entree: string | null;
  date_sortie_prevue: string | null;
  date_sortie_effective: string | null;
  heure_sortie: string | null;
  numero_chambre: string | null;
  nombre_personnes: number;
  numero_registre: string | null;

  // Signature Section
  date_signature: string | null;
  signature_url: string | null;
  signature_ip: string | null;

  // Minor Protection
  is_minor: boolean;
  age_calculated: number | null;
  guardian_id: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_document_number: string | null;

  // Verification & Risk
  verification_status: VerificationStatus;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  verification_notes: string | null;

  // Status
  status: PoliceFormStatus;
  submitted_at: string | null;
  police_notified: boolean;
  police_notified_at: string | null;

  // Offline Sync
  local_id: string | null;
  device_id: string | null;
  synced_at: string | null;

  // Metadata
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Sync Queue Item
export interface SyncQueueItem {
  id: string;
  device_id: string;
  user_id: string | null;
  property_id: string | null;
  operation: SyncOperation;
  table_name: string;
  record_id: string | null;
  local_id: string | null;
  payload: Record<string, unknown>;
  status: SyncStatus;
  priority: number;
  retry_count: number;
  max_retries: number;
  conflict_data: Record<string, unknown> | null;
  resolution: SyncResolution | null;
  error_message: string | null;
  error_code: string | null;
  created_at: string;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// Sync Metadata - Device sync state
export interface SyncMetadata {
  id: string;
  device_id: string;
  property_id: string | null;
  user_id: string | null;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  sync_token: string | null;
  device_name: string | null;
  device_type: 'ios' | 'android' | 'web' | null;
  app_version: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// CHECK-IN APP INPUT TYPES
// ============================================

export interface CreatePropertyStaffInput {
  property_id: string;
  full_name: string;
  phone: string;
  email?: string;
  role?: PropertyStaffRole;
  permissions?: string[];
  badge_number?: string;
  shift?: 'day' | 'night' | 'all';
}

export interface CreatePoliceFormInput {
  property_id: string;

  // Required Identity
  nom: string;
  prenoms: string;
  date_naissance: string;
  lieu_naissance: string;
  pays_departement: string;
  nationalite: string;

  // Required Document
  type_piece: PoliceDocumentType;
  numero_piece: string;

  // Required Establishment
  date_sortie_prevue: string;

  // Optional Identity
  nom_jeune_fille?: string;
  sexe?: 'M' | 'F';

  // Optional Document
  date_delivrance?: string;
  lieu_delivrance?: string;
  autorite_delivrance?: string;
  date_expiration?: string;
  document_photo_url?: string;

  // Optional Stay Information
  date_entree_senegal?: string;
  profession?: string;
  domicile_habituel?: string;
  email?: string;
  telephone?: string;
  provenance?: string;
  destination?: string;
  motif_voyage?: TravelMotive;
  motif_voyage_autre?: string;
  nb_enfants_moins_15?: number;
  immatriculation_vehicule?: string;

  // Optional Establishment
  date_entree?: string;
  heure_entree?: string;
  numero_chambre?: string;
  nombre_personnes?: number;

  // Guardian (for minors)
  guardian_name?: string;
  guardian_relationship?: string;
  guardian_document_number?: string;

  // Signature
  signature_url?: string;

  // Offline sync
  local_id?: string;
  device_id?: string;

  // Status
  status?: PoliceFormStatus;
}

export interface UpdatePoliceFormInput extends Partial<CreatePoliceFormInput> {
  id: string;
}

export interface PoliceFormCheckoutInput {
  form_id: string;
  date_sortie_effective?: string;
  heure_sortie?: string;
  notes?: string;
}

// ============================================
// CHECK-IN APP AUTH TYPES
// ============================================

export interface PropertyStaffAuthUser {
  id: string;
  phone: string;
  email?: string;
  staff_id: string;
  property_id: string;
  property_name: string;
  property_registration_number: string | null;
  role: PropertyStaffRole;
  landlord_id: string | null;
}

export interface PropertyStaffSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: PropertyStaffAuthUser;
}

// ============================================
// CHECK-IN APP SYNC TYPES
// ============================================

export interface SyncRequest {
  device_id: string;
  property_id: string;
  sync_token?: string;
  operations: Array<{
    operation: SyncOperation;
    table_name: string;
    local_id: string;
    record_id?: string;
    payload: Record<string, unknown>;
  }>;
}

export interface SyncResponse {
  success: boolean;
  sync_token: string;
  synced: Array<{
    local_id: string;
    server_id: string;
    table_name: string;
  }>;
  conflicts: Array<{
    local_id: string;
    record_id: string;
    table_name: string;
    client_data: Record<string, unknown>;
    server_data: Record<string, unknown>;
    suggested_resolution: SyncResolution;
  }>;
  server_changes: Array<{
    table_name: string;
    operation: SyncOperation;
    record_id: string;
    data: Record<string, unknown>;
    updated_at: string;
  }>;
  processed: number;
  failed: number;
}

// ============================================
// CHECK-IN APP DASHBOARD TYPES
// ============================================

export interface CheckinDashboardStats {
  today_checkins: number;
  today_checkouts: number;
  active_guests: number;
  pending_checkouts: number;
  rooms_occupied: number;
  rooms_total: number;
  pending_sync: number;
}

export interface PoliceFormWithDetails extends PoliceForm {
  property?: Property;
  guest?: Guest;
  stay?: Stay;
  created_by_staff?: PropertyStaff;
}

// ============================================
// CHECK-IN APP SEARCH TYPES
// ============================================

export interface PoliceFormSearchParams {
  property_id?: string;
  query?: string;
  nationalite?: string;
  date_entree_from?: string;
  date_entree_to?: string;
  status?: PoliceFormStatus;
  risk_level?: RiskLevel;
  is_minor?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: 'date_entree' | 'nom' | 'created_at' | 'risk_level';
  sort_order?: 'asc' | 'desc';
}

export interface PoliceFormSearchResult {
  data: PoliceForm[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  aggregations?: {
    by_nationality: Record<string, number>;
    by_risk_level: Record<RiskLevel, number>;
    by_status: Record<PoliceFormStatus, number>;
    minors_count: number;
  };
}

// ============================================
// PAYMENT MODULE RE-EXPORTS
// ============================================

export * from './payments.js';
