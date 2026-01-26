# PLAN: Secure API Keys with Supabase Edge Functions

> **Goal:** Enhance security by moving sensitive API Keys and Service URLs (like Google Script Webhook) from Client-side/Database to Supabase Edge Functions. This prevents exposure to the browser.
> **Level:** 2 (Backend Proxy)

## 1. Analysis & key Identification
Currently, the following might be exposed or hardcoded:
- **Google Script URL** (Used for Email Notifications): Currently stored in `app_settings` or hardcoded. Vulnerability: Anyone with the URL can trigger spam.
- **Supabase Keys**: Hardcoded in `supabaseClient.ts`. (Standard for `ANON` key, but `SERVICE_ROLE` key must NEVER be here).

**Target Architecture:**
`Client (React)` -> `Supabase Edge Function (Server)` -> `3rd Party Service (Google/ETC)`

## 2. Implementation Steps

### Phase 1: Environment & Setup
- [ ] **Audit Keys**: Identify exactly which 3rd party URLs/Keys need hiding. (Priority: Email Notification URL).
- [ ] **Supabase Secrets**: Plan to use Supabase Dashboard > Settings > Edge Functions to store secrets (e.g., `EMAIL_SERVICE_URL`).

### Phase 2: Create Edge Function (`send-email`)
- [ ] **Scaffold Function**: Create a new Deno-based Edge Function.
- [ ] **Auth Verification**: Ensure the function checks `Authorization` header (User must be logged in).
- [ ] **Logic**:
    - Receive JSON { recipient, subject, body } from Client.
    - Read `EMAIL_SERVICE_URL` from Environment Variables.
    - Proxy the request to Google Apps Script.
    - Return success/error to Client.

### Phase 3: Update Frontend
- [ ] **Refactor `sendAssignmentEmail` (or equivalent)**:
    - Stop fetching URL from `app_settings`.
    - Change to `supabase.functions.invoke('send-email', ...)`
- [ ] **Remove Legacy Config**: Delete the exposed `email_script_url` from `app_settings` (database).

### Phase 4: Clean Up Source Code
- [ ] **Environment Variables**: Move `SUPABASE_URL` and `SUPABASE_ANON_KEY` to `.env.local` (Vite standard) instead of hardcoding in `supabaseClient.ts`.
- [ ] **Gitignore**: Ensure `.env` files are ignored.

## 3. Verification Checklist
- [ ] Client can still trigger emails successfully.
- [ ] Network tab in Browser shows call to `functions/v1/send-email`, NOT `script.google.com`.
- [ ] Attempting to call Edge Function without Login returns 401 Unauthorized.
- [ ] Source code no longer contains hardcoded secrets.

## 4. Execution Plan (Next Session)
We will likely need to simulate the Edge Function creation if we cannot run Supabase CLI directly, or I will guide you to run the CLI commands.

**Immediate Action:**
1. Create `.env` file for Supabase Config.
2. Refactor `supabaseClient.ts` to use `import.meta.env`.
3. Guide user to setup Edge Function for Email.
