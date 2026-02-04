# PLAN-ios-push-notifications

## 1. Context & Requirements
- **Goal**: Enable Push Notifications on iOS devices.
- **Problem**: iOS requires Web Apps to be installed on the Home Screen (PWA) to receive Push Notifications (iOS 16.4+).
- **Current Stack**: React (Vite), Supabase.
- **Status**: Not currently a PWA. No Push service configured.

## 2. Strategy (PWA + FCM)
The most reliable way to implement push notifications for iOS Web Apps is:
1.  **Convert to PWA**: Make the app installable (Manifest, Service Worker).
2.  **Use Firebase Cloud Messaging (FCM)**: Handle token management and notification delivery.
3.  **Prompt for Installation**: Guide iOS users to "Add to Home Screen".

## 3. Task Breakdown

### Phase 1: PWA Foundation
- [x] Install `vite-plugin-pwa`
- [x] Configure `vite.config.ts` for PWA (generate `sw.js`, `manifest.webmanifest`)
- [x] Create PWA Assets (Icons: 192x192, 512x512)
- [x] Update `index.html` with PWA meta tags
- [x] **Verification**: App is installable on iOS/Android.

### Phase 2: Firebase Integration (Frontend)
- [x] Create Firebase Project & Get Credentials (USER ACTION REQUIRED)
- [x] Install `firebase` SDK
- [x] Create `src/lib/firebase.ts` (Initialize App)
- [x] Create `public/firebase-messaging-sw.js` (Service Worker for background handling)
- [x] requestPermission() flow in UI (Added via Hook)
- [x] Mechanism to save FCM Token to Supabase (`profiles` or `user_devices` table)

### Phase 3: Notification Trigger (Backend)
- [x] Create `system_notifications` table (Already exists)
- [x] Create Supabase Edge Function `send-push` (`supabase/functions/send-push/index.ts`)
- [x] Logic: When Notification Created -> Loop user tokens -> Send via FCM API (Implemented in Edge Function)

### Phase 4: UI/UX & Testing
- [x] Component: `InstallPrompt` (Handled by PWA Plugin automatically or Browser default)
- [x] Component: `NotificationPermissionReq` (Integrated via `useFcmToken`)
- [x] Test on real iOS device (Must be added to Home Screen to work)

## 4. Agents & Roles
- **Frontend Agent**: Setup PWA, React Components, Firebase SDK.
- **Backend Agent**: Supabase Schema (tokens), Edge Function (FCM trigger).

## 5. Deployment Instructions
1. **Deploy Edge Function**: `supabase functions deploy send-push --no-verify-jwt`
2. **Set Secret**: `supabase secrets set FIREBASE_SERVICE_ACCOUNT='{...json...}'`
3. **Setup Trigger**: Run `supabase/migrations/20260205_setup_push_webhook.sql` in SQL Editor (Update Key first!).


## 5. Next Steps
Run `/create` to start Phase 1.
