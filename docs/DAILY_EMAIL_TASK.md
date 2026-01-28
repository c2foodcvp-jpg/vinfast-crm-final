# Task: Implement Daily Morning Email Report

## Overview
The user wants a daily automated email sent at 6:00 AM to each sales representative/staff member.
The email should summarize:
1.  **Due Today**: Number of customers with `recare_date` matching today.
2.  **Overdue**: Number of customers with `recare_date` in the past (and not completed/lost).
3.  **Long-Term Expired**: Number of customers marked `is_long_term` where `long_term_return_date` has arrived or passed.

## Architecture
Since the CRM is a Single Page Application (SPA), we cannot rely on the frontend to trigger this schedule.
We will utilize **Google Apps Script (GAS)**'s time-driven triggers (ClockTrigger) to execute this job.
The GAS script will:
1.  Connect to the Supabase Database via REST API.
2.  Fetch all active staff profiles (to get email addresses).
3.  Fetch relevant customers.
4.  Process the data to group by Sales Representative.
5.  Send personalized emails via Gmail App.

## Steps

### 1. Update Google Apps Script (`UPDATED_EMAIL_SCRIPT.gs`)
- Add `sendDailyMorningReport()` function.
- Add helper function `fetchFromSupabase(table, query)` using `UrlFetchApp`.
- Implement date logic to classify customers (Due, Overdue, LongTermExpired).
- Implement grouping logic (customer -> sales_rep).
- Implement HTML email template for the report.

### 2. Configuration & Security
- The script requires `SUPABASE_URL` and `SUPABASE_KEY` (Anon or Service Role).
- We will document how to set these in 'Script Properties' in Google Apps Script to avoid hardcoding secrets.

### 3. Documentation
- Create `docs/DAILY_EMAIL_GUIDE.md` to guide the user on:
    - Copying the new code.
    - Setting up the Script Properties.
    - Adding the "Time-driven" trigger for 6:00 AM.

## Database Query Strategy
- **Profiles**: `GET /rest/v1/profiles?select=id,full_name,email`
- **Customers**: `GET /rest/v1/customers?select=id,name,phone,recare_date,is_long_term,long_term_return_date,creator_id,sales_rep,status,interest&status=neq.Chốt đơn&status=neq.Đã hủy`
    - We filter out 'Won' and 'Lost' statuses to reduce payload.
    - We fetch all active customers and process logic in memory (GAS V8 engine is fast enough for typical CRM sizes < 10k rows).

## Email Content
Subject: `[VinFast CRM] Báo cáo công việc ngày DD/MM/YYYY`
Body:
- Greeting.
- Summary Counts:
    - 🔴 Quá hạn: X
    - 🟡 Đến hạn hôm nay: Y
    - 🔵 Hết hạn CS dài hạn: Z
- Call to Action: Link to CRM.

## Approval
User has requested this via `/create`. Proceeding with implementation.
