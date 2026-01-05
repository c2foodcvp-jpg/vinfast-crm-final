import { createClient } from '@supabase/supabase-js';

// Configuration provided by the user
const SUPABASE_URL = 'https://ksrzwrizbqkjyzqhkfkn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzcnp3cml6YnFranl6cWhrZmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzkyMDcsImV4cCI6MjA4MjkxNTIwN30.8OxhjfjI0hqfYONKO4sC650KZO8uGNFtdwSV-2rmbEA';

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
