// utils/emailService.ts
// Level 2 Security: Secure Email Service using Supabase Edge Functions
// This module replaces direct calls to Google Script with secure backend proxy

import { supabase } from '../supabaseClient';

interface EmailPayload {
    to: string;
    subject: string;
    body?: string;
    templateType?: 'assignment' | 'reminder' | 'notification' | 'payment' | 'default';
    templateData?: Record<string, any>;
}

interface EmailResponse {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Send email through secure backend proxy (Edge Function)
 * This hides the Google Script URL from the client-side
 * 
 * @param payload Email data including recipient, subject, and body/template
 * @returns Promise<EmailResponse>
 */
export async function sendSecureEmail(payload: EmailPayload): Promise<EmailResponse> {
    try {
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: payload
        });

        if (error) {
            console.error('Edge Function error:', error);
            return {
                success: false,
                error: error.message || 'Failed to send email'
            };
        }

        return {
            success: true,
            message: data?.message || 'Email sent successfully'
        };
    } catch (err: any) {
        console.error('sendSecureEmail error:', err);
        return {
            success: false,
            error: err.message || 'Unknown error occurred'
        };
    }
}

/**
 * Send assignment notification email (when customer is assigned to employee)
 */
export async function sendAssignmentEmailSecure(params: {
    employeeEmail: string;
    employeeName: string;
    customerName: string;
    customerPhone: string;
    customerInterest?: string;
    notes?: string;
}): Promise<EmailResponse> {
    return sendSecureEmail({
        to: params.employeeEmail,
        subject: `📋 Khách hàng mới: ${params.customerName}`,
        templateType: 'assignment',
        templateData: params
    });
}

/**
 * Send reminder email (for tasks/appointments)
 */
export async function sendReminderEmailSecure(params: {
    recipientEmail: string;
    recipientName: string;
    taskTitle: string;
    taskContent?: string;
    deadlineTime: string;
    customerName?: string;
}): Promise<EmailResponse> {
    return sendSecureEmail({
        to: params.recipientEmail,
        subject: `⏰ Nhắc nhở: ${params.taskTitle}`,
        templateType: 'reminder',
        templateData: params
    });
}

/**
 * Send payment notification email
 */
export async function sendPaymentEmailSecure(params: {
    recipientEmail: string;
    recipientName: string;
    customerName: string;
    amount: number;
    paymentType: string;
    notes?: string;
}): Promise<EmailResponse> {
    return sendSecureEmail({
        to: params.recipientEmail,
        subject: `💰 Thông báo thanh toán: ${params.customerName}`,
        templateType: 'payment',
        templateData: params
    });
}

// ============================================
// MIGRATION HELPER: Legacy function wrapper
// Use this during transition period, then remove
// ============================================
/**
 * @deprecated Use sendSecureEmail instead. This is a migration helper.
 * Wraps the old pattern of fetching email_script_url from database
 */
export async function sendEmailLegacyWrapper(
    fetchUrlFromDb: () => Promise<string | null>,
    payload: Record<string, any>
): Promise<boolean> {
    console.warn('[DEPRECATED] sendEmailLegacyWrapper: Please migrate to sendSecureEmail()');

    // Try new secure method first
    const result = await sendSecureEmail({
        to: payload.to || payload.recipient,
        subject: payload.subject,
        body: payload.body || payload.htmlBody,
        templateType: payload.templateType,
        templateData: payload
    });

    return result.success;
}
