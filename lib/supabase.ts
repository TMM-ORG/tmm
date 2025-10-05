import { createClient } from '@supabase/supabase-js';

// Validate required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabasePublishableKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variable');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Server-side client with secret publishable key (for admin operations)
export const createServerClient = () => {
  const secretPublishableKey = process.env.SUPABASE_SECRET_PUBLISHABLE_KEY;

  if (!secretPublishableKey) {
    throw new Error('Missing SUPABASE_SECRET_PUBLISHABLE_KEY environment variable');
  }

  return createClient(supabaseUrl, secretPublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};