import { createClient } from '@supabase/supabase-js';

// Server-only client using the service role key. Only ever import this
// from files under app/api/** — never from a client component.
export function supabaseServer() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
