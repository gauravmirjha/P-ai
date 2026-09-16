import { createClient } from '@supabase/supabase-js';

// Browser-side client. Uses the public anon key only — never the service
// role key here, since this file ships to the client.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
