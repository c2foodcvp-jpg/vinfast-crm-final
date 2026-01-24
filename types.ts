
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
  created_at?: string;
}

// NEW: Car Version (Phiên bản xe, ví dụ VF6 Plus, VF6 Eco)
export interface CarVersion {
  id: string;
  model_id: string;
  name: string; // e.g. "Plus", "Eco"
  price: number; // Giá niêm yết
  manager_id?: string;
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

  // Restricted Permissions
  is_locked_add?: boolean; // Block adding new customers
  is_locked_view?: boolean; // Block viewing/editing existing customers
  is_locked_quote?: boolean; // Block Quote & Interest Calculator pages
  is_locked_advance?: boolean; // Block salary advance requests

  created_at?: string;
  discord_config?: any;
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

  // Virtual field for UI
  _is_delegated?: boolean;
  _shared_permission?: 'view' | 'edit'; // New field for per-customer share
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
export type TransactionType = 'revenue' | 'deposit' | 'advance' | 'expense' | 'adjustment' | 'dealer_debt' | 'repayment' | 'incurred_expense' | 'personal_bonus';
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
  created_at: string;
  _is_part_time_creator?: boolean; // Helper for finance calc
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
