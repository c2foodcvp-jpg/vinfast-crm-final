# PLAN: Centralized Approval Center (Popup Duyệt Tổng Hợp)

## 1. Objective
Create a unified "Approval Center" popup accessible from the main navigation (or dashboard). This popup will aggregate **all** pending requests across the system that require Admin or Manager approval, eliminating the need to visit multiple pages to find tasks.

## 2. Key Features

### 2.1. Central Launch Point
- Add a "bell" or "gavel" icon in the top header/sidebar (near notifications).
- Show a **Red Badge** with the count of total pending items.

### 2.2. The Approval Modal
A large modal with tabs for different categories:

#### **Tab A: Khách hàng (Customer Requests)**
Query `customers` table where:
1.  `status = 'WON_PENDING'` (Chốt đơn)
2.  `status = 'LOST_PENDING'` (Báo hủy)
3.  `deal_status = 'suspended_pending'` (Xin treo hồ sơ)
4.  `deal_status = 'refund_pending'` (Xin hoàn tiền)
5.  `pending_transfer_to IS NOT NULL` (Xin chuyển quyền - if applicable)

**Action:**
- Show customer name, sales rep, request type, reason.
- Buttons: **Duyệt (Approve)** / **Từ chối (Reject)**.

#### **Tab B: Tài chính (Finance Requests)**
Query `transactions` table where:
1.  `status = 'pending'`
2.  Types: `advance` (Ứng), `expense` (Chi), `deposit` (Nộp - if pending), `loan` (Mượn).

**Action:**
- Show requester, amount, type, reason.
- Buttons: **Duyệt (Approve)** / **Từ chối (Reject)**.

#### **Tab C: Đề xuất khác (Proposals - Optional)**
Query `proposals` table (if in use) for `status = 'pending'`.

### 2.3. Logic & Permissions
- **Admin:** Sees ALL pending requests system-wide.
- **Mod (Manager):** Sees requests ONLY from their team members (based on `manager_id`).

## 3. Implementation Plan

### Step 1: Component Structure
- Create `components/ApprovalModal.tsx`.
- Create `components/ApprovalBadge.tsx` (for the header trigger).

### Step 2: Data Fetching (Supabase)
- **Customers Query:**
  ```sql
  SELECT * FROM customers 
  WHERE status IN ('WON_PENDING', 'LOST_PENDING') 
     OR deal_status IN ('suspended_pending', 'refund_pending')
     OR pending_transfer_to IS NOT NULL
  ```
- **Transactions Query:**
  ```sql
  SELECT * FROM transactions WHERE status = 'pending'
  ```
- *Optimization:* Use `Promise.all` to fetch parallelly.

### Step 3: Action Handlers
 Reuse existing logic from `CustomerDetail` and `Finance`.
- **Approve Customer:** Update `status` / `deal_status` / `delivery_progress`.
- **Approve Finance:** Update `transactions.status`.

### Step 4: Integration
- Add `ApprovalModal` to `Layout.tsx` or `App.tsx` (Global Context).
- Add `ApprovalBadge` to `Sidebar` or `Header`.

## 4. Verification
- Create test users (Employee) to submit:
  - 1 Deal Won request
  - 1 Advance request
- Log in as Admin/Mod.
- Verify Badge count = 2.
- Open Modal -> Approve items.
- Verify items updated in DB.
