import { createClient } from '@supabase/supabase-js';

// Configuration provided by the user
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase Environment Variables. Please restart the dev server.');
    if (typeof window !== 'undefined') {
        alert('DEBUG: Không tìm thấy biến môi trường (.env).\nHãy KHỞI ĐỘNG LẠI terminal "npm run dev" để khắc phục!');
    }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * DATABASE SCHEMA ASSUMPTION (Based on typical CRM needs)
 * 
 * Table: profiles
 * - id: uuid (primary key, references auth.users)
 * - full_name: text
 * - role: text ('admin', 'mod', 'employee')
 * - phone: text
 * - manager_id: uuid (references profiles.id, optional)
 * 
 * Table: customers
 * - id: uuid (primary key)
 * - full_name: text
 * - phone: text
 * - email: text
 * - status: text
 * - assigned_to: uuid (references profiles.id)
 * - created_at: timestamptz
 * 
 * Table: interactions
 * - id: uuid
 * - customer_id: uuid (references customers.id)
 * - user_id: uuid (references profiles.id)
 * - type: text
 * - content: text
 * - created_at: timestamptz
 */
