
export enum UserRole {
  ADMIN = 'admin',
  MOD = 'mod',
  EMPLOYEE = 'employee'
}

export type UserStatus = 'active' | 'pending' | 'blocked';

export enum CustomerStatus {
  NEW = 'Mới',
  CONTACTED = 'Đã liên hệ',
  POTENTIAL = 'Tiềm năng',
  WON = 'Chốt đơn',             // Đã duyệt chốt
  WON_PENDING = 'Chờ duyệt chốt', // Chờ Admin/Mod duyệt
  LOST = 'Đã hủy',              // Đã duyệt hủy
  LOST_PENDING = 'Chờ duyệt hủy', // Chờ Admin/Mod duyệt
  AFTER_SALES = 'Chăm sóc sau bán'
}

export type DealStatus = 'processing' | 'completed_pending' | 'completed' | 'refund_pending' | 'refunded' | 'suspended_pending' | 'suspended';

export type CustomerClassification = 'Hot' | 'Warm' | 'Cool';

// Fallback constant if DB is empty
export const CAR_MODELS = [
  'VF 3', 'VF 5 Plus', 'VF 6', 'VF 7', 'VF 8', 'VF 9', 'VF e34',
  'Minio Green', 'Herio Green', 'Limo Green', 'Ec Van', 'Lạc Hồng'
];

export interface CarModel {
  id: string;
  name: string;
  manager_id?: string; // Team isolation
  priority?: number; // Sorting order
  created_at?: string;
}

// NEW: Car Version (Phiên bản xe, ví dụ VF6 Plus, VF6 Eco)
export interface CarVersion {
  id: string;
  model_id: string;
  name: string; // e.g. "Plus", "Eco"
  price: number; // Giá niêm yết
  premium_color_amount?: number; // Số tiền màu nâng cao
  manager_id?: string;
}

// NEW: Registration Service (Dịch vụ đăng ký xe)
export interface RegistrationService {
  id: string;
  label: string;
  value: number;
  is_active?: boolean;
  priority?: number;
  manager_id?: string; // Team isolation
}

// NEW: Fee Options & VinPoint Mapping
export interface QuoteConfigOption {
  label: string;
  value: number;
  model_id?: string; // Optional: Link to specific car model for VinPoints
}

// NEW: Quote Configuration (Khuyến mãi & Phí & Bảo hành)
export interface QuoteConfig {
  id: string;
  type: 'promotion' | 'fee' | 'gift' | 'membership' | 'warranty';
  name: string;
  value: number; // Giá trị mặc định (Giảm giá cho Membership, 0 cho warranty)
  value_type: 'percent' | 'fixed'; // Giảm % hay tiền mặt
  priority: number; // Thứ tự ưu tiên tính toán
  is_active: boolean;
  apply_to_model_ids?: string[]; // Áp dụng cho dòng xe nào (null = all)

  // New Fields
  target_type?: 'invoice' | 'rolling'; // 'invoice' = Trừ vào giá xe (XHĐ), 'rolling' = Trừ vào lăn bánh
  apply_to_version_ids?: string[]; // Áp dụng cho phiên bản cụ thể (null/empty = all versions of selected model)
  is_default?: boolean; // Default selection state

  // NEW: Options for Fees (e.g., HCM vs Tinh) OR VinPoint mapping
  options?: QuoteConfigOption[];

  // NEW: Gift Ratio for Membership (% Tặng thêm)
  gift_ratio?: number;

  // NEW: Apply to specific regions (e.g. ['HCM', 'HN'])
  apply_to_regions?: string[];

  manager_id?: string;
}

// NEW: Bank Package Definition
export interface BankPackage {
  name: string;
  rate: number;
}

// NEW: Bank Configuration
export interface BankConfig {
  id: string;
  name: string;
  interest_rate_1y: number; // Deprecated or Default
  max_loan_ratio: number; // Tỉ lệ vay tối đa (ví dụ 80%)
  packages?: BankPackage[]; // NEW: List of packages
  logo_url?: string;
  manager_id?: string;
}

export interface Distributor {
  id: string;
  name: string;
  address?: string;
  image_url?: string; // URL of the uploaded image
  manager_id?: string; // Team isolation
  created_at?: string;
}

export interface DealDetails {
  payment_method: 'Tiền mặt' | 'Ngân hàng';
  plate_type: 'Biển trắng' | 'Biển vàng';
  revenue: number; // Doanh thu dự kiến ban đầu
  actual_revenue?: number; // Doanh thu thực tế tích lũy
  distributor: string;
  car_availability: 'Sẵn xe' | 'Đợi xe';
  has_accessories?: boolean; // Dự kiến có làm phụ kiện
  notes?: string;
}

export enum MembershipTier {
  MEMBER = 'Member',
  GOLD = 'Gold',
  PLATINUM = 'Platinum',
  DIAMOND = 'Diamond'
}

// Payment Account for Registration Fee Transfer
export interface PaymentAccount {
  id: string;
  user_id: string;
  name: string;
  content?: string;
  qr_code_url?: string;
  is_default?: boolean;
  created_at?: string;
}

// Default Registration Fee Values (VND)
export const DEFAULT_REGISTRATION_FEES = {
  tax: 0,                           // Thuế bạ
  plate_fee: 14_000_000,            // Lệ phí đăng ký biển số
  road_fee: 1_560_000,              // Phí đường bộ
  inspection_book_fee: 94_680,      // Lệ phí cấp sổ đăng kiểm
  civil_insurance: 530_700,         // Bảo hiểm trách nhiệm dân sự
  vehicle_insurance_rate: 0.014,    // 1.4% giá xe
  registration_service: 3_000_000   // Dịch vụ đăng ký xe
};

// Membership tier account limits
export const TIER_ACCOUNT_LIMITS: Record<string, number> = {
  'Member': 1,
  'Gold': 2,
  'Platinum': 3,
  'Diamond': 5
};

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string;
  manager_id?: string | null;
  kpi_target?: number; // Deprecated: Use EmployeeKPI table
  is_part_time?: boolean; // New Flag for Part-time
  profit_share_ratio?: number; // Custom profit share ratio (optional)

  // Membership Tier (New)
  member_tier?: MembershipTier;

  // Restricted Permissions
  is_locked_add?: boolean; // Block adding new customers
  is_locked_view?: boolean; // Block viewing/editing existing customers
  is_locked_quote?: boolean; // Block Quote & Interest Calculator pages
  is_locked_advance?: boolean; // Block salary advance requests
  can_access_leads_queue?: boolean; // MOD permission to access Leads Queue page

  // MOD Consultant Mode: When true, MOD only sees their own customers instead of team
  is_consultant_mode?: boolean;

  // NEW: Team QR Code (Manager Level)
  qr_code_url?: string;

  // NEW: Quote Template
  quote_template?: {
    title?: string;
    company_name?: string;
    subtitle?: string;
    bank_title?: string;
    logo_url?: string;
    use_logo?: boolean;
  };

  created_at?: string;
  last_login_at?: string; // Track last login time
  discord_config?: any;
  team_expiration_date?: string | null; // Expiration date for Team (MOD only)

  // New Profile Fields
  dealership_name?: string;
  introduction?: string;
  birthdate?: string; // YYYY-MM-DD
  can_manage_fund?: boolean; // NEW: Permission for Mod to adjust Fund Period
}


export interface EmployeeKPI {
  id: string;
  user_id: string;
  month: number;
  year: number;
  target: number;
  updated_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string; // Email khách hàng (Optional)
  secondary_phone?: string;
  location?: string;
  status: CustomerStatus;
  source?: string;
  interest?: string;
  sales_rep?: string;
  creator_id?: string;
  notes?: string;

  classification?: CustomerClassification;
  recare_date?: string;
  is_special_care?: boolean;
  special_care_start_date?: string;

  is_long_term?: boolean;
  long_term_return_date?: string;

  stop_reason?: string;
  deal_details?: DealDetails;
  deal_status?: DealStatus;

  pending_transfer_to?: string;
  is_acknowledged?: boolean;

  created_at: string;
  updated_at?: string;
  won_at?: string; // NEW: Official "Closing Date" for Progress Calculation

  // Virtual field for UI
  _is_delegated?: boolean;
  _shared_permission?: 'view' | 'edit'; // New field for per-customer share

  // Delivery Progress Tracking
  delivery_progress?: DeliveryProgress;

  // Fund Period Assignment (for period-based fund closing)
  fund_period_id?: string;
}

export interface DeliveryProgress {
  [key: string]: {
    completed: boolean;
    timestamp?: string; // ISO date string
    note?: string;
  };
}

export interface Interaction {
  id: string;
  customer_id: string;
  user_id: string;
  type: 'call' | 'meeting' | 'note' | 'email' | 'zalo' | 'test_drive';
  content: string;
  created_at: string;
}

export interface DashboardStats {
  totalCustomers: number;
  newLeadsToday: number;
  conversionRate: number;
  pendingTasks: number;
}

export interface SystemBackup {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
  record_count: number;
  data: Customer[];
}

// --- NEW TYPES FOR FINANCE & PROMOTIONS ---

// Added 'personal_bonus' to types
export type TransactionType = 'revenue' | 'deposit' | 'advance' | 'expense' | 'adjustment' | 'dealer_debt' | 'repayment' | 'incurred_expense' | 'personal_bonus' | 'loan' | 'loan_repayment';
export type TransactionStatus = 'pending' | 'approved' | 'rejected';

export interface Transaction {
  id: string;
  customer_id?: string; // Nullable for generic deposits
  customer_name?: string; // Cached name for display
  user_id: string; // Requester
  user_name?: string;
  type: TransactionType;
  subtype?: 'refundable' | 'deductible'; // For Advance
  target_date?: string; // For Dealer Debt (Expected Date)
  amount: number;
  reason: string;
  status: TransactionStatus;
  proof_url?: string; // For images/receipts
  approved_by?: string;
  rejection_reason?: string;
  created_at: string;
  _is_part_time_creator?: boolean; // Helper for finance calc
  fund_period_id?: string; // Explicit Fund Period Assignment
  transaction_date?: string; // NEW: Actual date of transaction
}

export interface TeamPolicy {
  id: string;
  manager_id: string;
  content: string; // HTML content
  updated_at: string;
}

export interface TeamInventory {
  id: string;
  manager_id: string;
  content: string; // HTML content
  updated_at: string;
}

export interface AppSettings {
  id: string;
  key: string;
  value: string;
}

export interface TeamFine {
  id: string;
  user_id: string; // Người bị phạt
  user_name?: string; // Cache name
  created_by: string; // Người phạt (Admin/Mod)
  amount: number;
  reason: string;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at?: string;
}

// NEW: Fund Period for period-based fund closing
export interface FundPeriod {
  id: string;
  name: string;              // e.g. "Quỹ T1/2026"
  start_date: string;        // ISO date (YYYY-MM-DD)
  end_date?: string;         // ISO date, null = open period
  closed_at?: string;        // ISO timestamp when closed
  closed_by?: string;        // UUID of user who closed
  is_completed?: boolean;    // NEW: Fund is fully completed/archived
  completed_at?: string;     // NEW: When fund was marked as completed
  manager_id?: string;       // Team isolation
  created_at: string;
}

export interface AccessDelegation {
  id: string;
  grantor_id: string; // Admin/Mod
  recipient_id: string; // User A (Người xem)
  target_user_id: string; // User B (Chủ dữ liệu)
  access_level: 'view' | 'edit';
  created_at: string;
}

export interface ProfitExclusion {
  id: string;
  user_id: string; // User bị loại trừ doanh thu từ khách này
  customer_id: string;
  created_at?: string;
}

// NEW: Customer Specific Share
export interface CustomerShare {
  id: string;
  customer_id: string;
  shared_by: string;
  shared_with: string; // User ID nhận share
  permission: 'view' | 'edit';
  created_at: string;
}

// --- NEW FOR PROPOSALS ---
export interface DemoCar {
  id: string;
  name: string; // Tên xe (VD: VF8 - Trắng)
  price: number; // Giá tiền mượn (trừ vào quỹ)
  owner_id: string; // TVBH sở hữu xe (được cộng tiền)
  manager_id?: string; // Team isolation
  created_at: string;
}

export type ProposalType = 'demo_car' | 'salary_advance';
export type ProposalStatus = 'pending' | 'approved' | 'rejected';

export interface Proposal {
  id: string;
  type: ProposalType;
  user_id: string;
  user_name?: string; // Cache
  data: any; // JSONB: { car_id, car_name, price } or { max_allowance, reason }
  amount: number;
  reason: string;
  status: ProposalStatus;
  approved_by?: string;
  created_at: string;
}

// NEW: Lead Email Page (MOD-specific configuration)
export interface LeadEmailPage {
  id: string;
  mod_id: string;
  name: string;
  email_script_url?: string;
  auto_import_script_url?: string; // Script URL to auto-import leads from external source
  source_filter?: string;         // Filter leads by source field
  auto_download_enabled?: boolean;
  auto_assign_enabled?: boolean;
  auto_assign_config?: {
    round_robin?: boolean;
    max_per_day?: number;
  };
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

