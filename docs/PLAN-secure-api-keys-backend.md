# PLAN: Secure API Keys with Supabase Edge Functions

> **Goal:** Enhance security by moving sensitive API Keys and Service URLs (like Google Script Webhook) from Client-side/Database to Supabase Edge Functions. This prevents exposure to the browser.
> **Level:** 2 (Backend Proxy)
> **Status:** ✅ IMPLEMENTATION COMPLETE - Awaiting Deployment

## 1. Analysis & Key Identification
Currently, the following might be exposed or hardcoded:
- **Google Script URL** (Used for Email Notifications): Currently stored in `app_settings` or hardcoded. Vulnerability: Anyone with the URL can trigger spam.
- **Supabase Keys**: Configured in `.env` via `import.meta.env`. (Standard for `ANON` key, but `SERVICE_ROLE` key must NEVER be in frontend).

**Target Architecture:**
```
Client (React) -> Supabase Edge Function (Server) -> 3rd Party Service (Google/ETC)
```

## 2. Implementation Steps

### Phase 1: Environment & Setup ✅ DONE
- [x] **Audit Keys**: Identified 3rd party URLs/Keys needing protection (Priority: Email Notification URL).
- [x] **Supabase Secrets**: Plan to use Supabase Dashboard > Settings > Edge Functions to store secrets.

### Phase 2: Create Edge Function (`send-email`) ✅ DONE
- [x] **Scaffold Function**: Created `supabase/functions/send-email/index.ts`
- [x] **Auth Verification**: Function checks `Authorization` header (User must be logged in).
- [x] **Logic**:
    - Receive JSON { to, subject, body, templateType, templateData } from Client.
    - Read `EMAIL_SCRIPT_URL` from Environment Variables.
    - Proxy the request to Google Apps Script.
    - Log email activity to `email_logs` table for audit.
    - Return success/error to Client.

### Phase 3: Update Frontend ✅ DONE
- [x] **Created `utils/emailService.ts`**: New secure email service with helper functions:
    - `sendSecureEmail()` - Generic secure email sender
    - `sendAssignmentEmailSecure()` - For customer assignment notifications
    - `sendReminderEmailSecure()` - For task reminders
    - `sendPaymentEmailSecure()` - For payment notifications
- [ ] **Migrate Components**: Update existing components to use new email service (gradual migration)
- [ ] **Remove Legacy Config**: Delete the exposed `email_script_url` from `app_settings` (after migration)

### Phase 4: Clean Up Source Code ✅ DONE
- [x] **Environment Variables**: `SUPABASE_URL` and `SUPABASE_ANON_KEY` now use `.env` via `import.meta.env`.
- [x] **Gitignore**: Ensure `.env` files are ignored.
- [x] **Audit Logging**: Created `email_logs` table for security audit trail.

## 3. Verification Checklist
- [ ] Client can still trigger emails successfully via Edge Function.
- [ ] Network tab in Browser shows call to `functions/v1/send-email`, NOT `script.google.com`.
- [ ] Attempting to call Edge Function without Login returns 401 Unauthorized.
- [ ] Source code no longer contains hardcoded secrets.

## 4. Deployment Instructions

### Step 1: Add Secret to Supabase
Run in terminal (or use Supabase Dashboard):
```bash
supabase secrets set EMAIL_SCRIPT_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
```

### Step 2: Deploy Edge Function
```bash
supabase functions deploy send-email
```

### Step 3: Run Database Migration
```bash
supabase db push
```
Or manually run `supabase/migrations/20260205_security_level2_email_logs.sql` in SQL Editor.

### Step 4: Test
```bash
# Test locally first
supabase functions serve send-email

# Then test via curl or frontend
```

## 5. Files Created/Modified

| File | Description |
|------|-------------|
| `supabase/functions/send-email/index.ts` | Edge Function for secure email proxy |
| `utils/emailService.ts` | Frontend helper for calling email Edge Function |
| `supabase/migrations/20260205_security_level2_email_logs.sql` | Audit log table |

## 6. Security Levels Summary

| Level | Description | Status |
|-------|-------------|--------|
| Level 1 | Basic RLS + Environment Variables | ✅ Complete |
| Level 2 | Backend Proxy (Edge Functions) | ✅ Implemented |
| Level 3 | Rate Limiting + IP Blocking | 🔄 Future |
| Level 4 | End-to-End Encryption | 🔄 Future |
