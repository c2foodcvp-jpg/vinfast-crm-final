
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
  created_at?: string;
}

export interface Distributor {
  id: string;
  name: string;
  address?: string;
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
  kpi_target?: number; // Target number of cars per month
  is_part_time?: boolean; // New Flag for Part-time
  profit_share_ratio?: number; // Custom profit share ratio (optional)
  created_at?: string;
  discord_config?: any;
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

export type TransactionType = 'revenue' | 'deposit' | 'advance' | 'expense' | 'adjustment' | 'dealer_debt' | 'repayment' | 'incurred_expense';
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
