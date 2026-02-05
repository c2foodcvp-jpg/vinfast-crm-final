// supabase/functions/send-email/index.ts
// Level 2 Security: Backend Proxy for Email Notifications
// This function hides the Google Script URL from the client-side

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Verify User Authentication
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        // Create client with user's JWT to verify they are logged in
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Get Email Script URL from Secrets (NOT from database anymore)
        const emailScriptUrl = Deno.env.get('EMAIL_SCRIPT_URL');
        if (!emailScriptUrl) {
            console.error('EMAIL_SCRIPT_URL secret not configured');
            return new Response(
                JSON.stringify({ error: 'Email service not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 3. Parse Request Body
        const payload = await req.json();
        const { to, subject, body, templateType, templateData } = payload;

        if (!to || !subject) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: to, subject' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 4. Proxy the request to Google Script
        const googlePayload = {
            to,
            subject,
            body: body || '',
            templateType: templateType || 'default',
            templateData: templateData || {},
            senderUserId: user.id, // Include sender info for logging/audit
            timestamp: new Date().toISOString()
        };

        const googleResponse = await fetch(emailScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(googlePayload)
        });

        const googleResult = await googleResponse.text();

        // 5. Optional: Log email activity for audit (using service role)
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseServiceKey) {
            const adminClient = createClient(supabaseUrl, supabaseServiceKey);
            await adminClient.from('email_logs').insert({
                user_id: user.id,
                recipient: to,
                subject: subject,
                status: googleResponse.ok ? 'sent' : 'failed',
                created_at: new Date().toISOString()
            }).catch(err => console.log('Email log insert failed (table may not exist):', err.message));
        }

        // 6. Return result
        if (googleResponse.ok) {
            return new Response(
                JSON.stringify({ success: true, message: 'Email sent successfully' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        } else {
            return new Response(
                JSON.stringify({ error: 'Failed to send email', details: googleResult }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

    } catch (error) {
        console.error('send-email error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
