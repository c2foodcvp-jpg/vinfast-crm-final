# PLAN: Quick Interaction Popup Implementation

## Objective
Implement a "Quick Interaction Popup" feature in the **Calendar (Lịch làm việc)** page.
This allows users to log interactions (Call, Note, Meeting, Zalo) and update customer status/recare date directly from the calendar/dashboard view without navigating to the full Customer Detail page.

## User Requirements
- **Target Page**: Calendar Page (`pages/Calendar.tsx`) (and potentially Dashboard if reused).
- **Functionality**: Click on a customer card -> Open Popup -> Log interaction -> Save.
- **Context**: User provided an image of the Dashboard/Kanban view, but explicitly stated "Calendar Page". The code in `Calendar.tsx` matches the Kanban-like layout (Columns: CS Đặc biệt, Cần CS hôm nay...).

## Implementation Steps

### Phase 1: Planning (Completed)
- [x] Analyze codebase (`Calendar.tsx`, `Dashboard.tsx`, `CustomerDetail.tsx`).
- [x] Identify reusable logic (Interaction insertion from `CustomerDetail.tsx`).
- [x] Define component structure.

### Phase 2: Implementation

#### 1. Create `components/QuickInteractionModal.tsx`
- **Type**: New Component.
- **Props**:
    - `isOpen`: boolean
    - `onClose`: function
    - `customer`: Customer object (id, name, phone, sales_rep...)
    - `userProfile`: UserProfile object (from AuthContext)
    - `onSuccess`: function (callback to refresh parent data)
- **Features**:
    - **Header**: Customer Info (Name, Phone, Status badge).
    - **Tabs/Buttons**: Call, Zalo, Meeting, Note.
    - **Form**:
        - `content` (Textarea).
        - `recare_date` (Date picker) - Optional update.
        - `classification` (Select) - Optional update.
    - **Actions**:
        - "Lưu tương tác" (Save) button.
        - "Hủy" (Cancel) button.
- **Logic**:
    - `supabase.from('interactions').insert(...)`
    - `supabase.from('customers').update(...)` (if date/class changed).

#### 2. Integrate into `pages/Calendar.tsx`
- **State**:
    - `selectedCustomer`: Customer | null
    - `showQuickModal`: boolean
- **Modification**:
    - Import `QuickInteractionModal`.
    - Update `CustomerCard`'s `onClick` handler.
        - **Current**: `navigate('/customers/' + id)`
        - **New**: `setSelectedCustomer(customer); setShowQuickModal(true);`
    - Render `<QuickInteractionModal ... />` at the bottom of the page.

### Phase 3: Verification & Polish
- [ ] Verify functionality:
    - Click customer -> Modal opens.
    - Save interaction -> Toast success -> Modal closes.
    - Data check: Allow user to verify if interaction appears in Customer Detail.
- [ ] Check permissions (Admin vs Mod vs Sales).
- [ ] Responsive design check.

## Risky Items
- **Navigation Overlay**: Ensure modifying `onClick` doesn't break other features if accessible elsewhere.
- **Data Sync**: The Calendar view might need to refresh (`fetchData()`) after an interaction if the status/date changes (e.g., updating Recare Date should move the customer to a different column or remove them from "Overdue").

## Approval Required
- Proceed with creating `QuickInteractionModal.tsx`?
- Proceed with modifying `Calendar.tsx`?
