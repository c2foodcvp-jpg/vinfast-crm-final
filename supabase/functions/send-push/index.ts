
// supabase/functions/send-push/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import * as jose from "https://deno.land/x/jose@v4.13.1/index.ts";

console.log("Loading send-push function...");

// Service Account from Firebase Console
// You should store the whole JSON content in a SUPABASE SECRET named 'FIREBASE_SERVICE_ACCOUNT'
// OR store individual fields. Here assuming 'FIREBASE_SERVICE_ACCOUNT' contains the JSON string.
// If you don't have the JSON, you need to construct the JWT manually with private key.

const getAccessToken = async ({ client_email, private_key }: { client_email: string, private_key: string }) => {
    const alg = 'RS256';
    const jwt = await new jose.SignJWT({
        iss: client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token'
    })
        .setProtectedHeader({ alg })
        .setExpirationTime('1h')
        .setIssuedAt()
        .sign(await jose.importPKCS8(private_key, alg));

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const data = await response.json();
    return data.access_token;
};

serve(async (req) => {
    try {
        const { record } = await req.json(); // Payload from Database Webhook or explicit call

        // Validate payload
        if (!record || !record.title || !record.body) {
            // Handle case where function is called directly with { title, body, user_id }
            // This block is for manual testing or direct invocation
            const body = await req.json().catch(() => ({}));
            if (body.title && body.body) {
                // proceed with body
            } else {
                return new Response("Missing record or title/body", { status: 400 });
            }
        }

        const title = record.title;
        const message = record.content || record.body; // 'content' in DB, 'body' in payload usually
        const targetScope = record.target_scope;
        const targetUserIds = record.target_user_ids; // Array of UUIDs

        // 1. Get Firebase Access Token
        const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
        if (!serviceAccountStr) {
            throw new Error("Missing FIREBASE_SERVICE_ACCOUNT secret");
        }
        const serviceAccount = JSON.parse(serviceAccountStr);
        const accessToken = await getAccessToken(serviceAccount);

        // 2. Initial Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Dynamic import to avoid build errors if not available locally, but usually standard in Deno
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(supabaseUrl, supabaseKey);

        let query = supabase.from('user_devices').select('fcm_token');

        // Logic for Targeting
        if (targetScope === 'specific' && targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
            query = query.in('user_id', targetUserIds);
        } else if (targetScope === 'team' && record.target_team_id) {
            // Fetch team members
            const { data: profiles } = await supabase.from('profiles')
                .select('id')
                .or(`manager_id.eq.${record.target_team_id},id.eq.${record.target_team_id}`);

            if (profiles && profiles.length > 0) {
                const teamUserIds = profiles.map(p => p.id);
                query = query.in('user_id', teamUserIds);
            } else {
                return new Response(JSON.stringify({ message: "No team members found" }), { headers: { "Content-Type": "application/json" } });
            }
        } else if (targetScope === 'all') {
            // No filter, send to all devices
            // WARNING: This might hit limits for large user bases.
        } else {
            // If we can't determine target, maybe do nothing?
            // For now, let's assume if explicit user_id passed in payload (from non-DB source), allow it
            if (record.user_id) {
                query = query.eq('user_id', record.user_id);
            }
        }

        const { data: devices, error } = await query;

        if (error) throw error;
        if (!devices || devices.length === 0) {
            return new Response(JSON.stringify({ message: "No devices found" }), { headers: { "Content-Type": "application/json" } });
        }

        const tokens = devices.map(d => d.fcm_token);

        // 3. Send Notifications via FCM v1 API
        // We have to send one by one or batch. v1 API recommends individual or batch API.
        // Loop for simplicity
        const results = [];

        for (const token of tokens) {
            const fcmMessage = {
                message: {
                    token: token,
                    notification: {
                        title: title,
                        body: message,
                    },
                    webpush: {
                        fcm_options: {
                            link: 'https://vinfast-crm.web.app' // Optional: Update with your URL
                        }
                    }
                }
            };

            const res = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fcmMessage)
            });
            results.push(res.status);
        }

        return new Response(
            JSON.stringify({ success: true, sent_count: results.length }),
            { headers: { "Content-Type": "application/json" } },
        );

    } catch (error) {
        console.error(error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
});
