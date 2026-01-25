
# IMPLEMENTATION PLAN: Email-to-Lead Automation

> **Status**: DRAFT / PROPOSAL
> **Goal**: Automate customer creation from incoming emails and provide a UI for manual distribution.

## 0. Socratic Discovery (Questions for You)
Before we start coding, I need to know:
1.  **Email Provider**: Are you using Gmail, Outlook, or a custom domain? (Determines connection method: API vs IMAP).
2.  **Email Source**: Are these emails coming from a Website Form (structured) or written by humans (unstructured)?
3.  **Preferred Tool**: Are you open to using **n8n / Zapier** (easier, recommended) to parse and push data, or do you strictly want a **Custom Code** solution (Next.js API Route + Mailgun/Sendgrid)?

---

## 1. Architecture Overview (Proposed)

We will build a **"Lead Queue"** workflow:

1.  **Ingestion**: Emails arrive -> Parsed -> Data extracted (Name, Phone, etc.).
2.  **Database**: Saved to `customers` table with a special status (e.g., `status: 'lead'`, `sales_rep: null`).
3.  **UI (Trang Chờ)**: A new page `LeadDistribution.tsx` for Managers.
4.  **Action**: Manager selects leads -> Bulk assigns to Sales Reps.

---

## 2. Implementation Steps

### Phase 1: Database & Schema
- [ ] **Modify `customers` table**:
    - Ensure `sales_rep` is nullable (already is).
    - Add `source_channel` column (e.g., 'Email', 'Web').
    - Add `email_raw_content` (optional, for debugging).
- [ ] **Create "Pending Leads" View**:
    - Database function or query to fetch customers where `sales_rep IS NULL`.

### Phase 2: Ingestion Pipeline (The "How")
*Option A: Integration Platform (Recommended)*
- [ ] Setup n8n/Zapier Webhook.
- [ ] Trigger: New Email.
- [ ] Action: Parse Body (Regex/AI).
- [ ] Action: Call Supabase API (`POST /rest/v1/customers`).

*Option B: Custom API Route*
- [ ] Create `pages/api/webhooks/incoming-email.ts`.
- [ ] Parse JSON payload (from Sendgrid/Mailgun).
- [ ] Insert into Supabase.

### Phase 3: Frontend - "Trang Chờ" (The Queue)
- [ ] **Create `pages/LeadsQueue.tsx`**:
    - Table filtering only `sales_rep === null`.
    - Columns: Name, Phone, Source, Email Subject, Time Received.
- [ ] **Bulk Assignment UI**:
    - Checkbox selection.
    - "Phân bổ cho..." dropdown (List of Sales Reps).
    - "Auto-distribute" button (Round-robin logic - Optional).

### Phase 4: Notification
- [ ] Notify Admin when new leads arrive.
- [ ] Notify Sales Rep when they are assigned a lead.

---

## 3. Immediate Next Steps
1.  **Answer the "Socratic Discovery" questions above.**
2.  **Type `/approve`** if you agree with this architecture.
