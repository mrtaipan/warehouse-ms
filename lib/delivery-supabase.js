import { createClient } from '@supabase/supabase-js'

const deliverySupabaseUrl =
  process.env.NEXT_PUBLIC_DELIVERY_REPORT_SUPABASE_URL ||
  'https://opgqhmwtqemozzkvcntr.supabase.co'

const deliverySupabasePublishableKey =
  process.env.NEXT_PUBLIC_DELIVERY_REPORT_SUPABASE_KEY ||
  'sb_publishable_1o638kmQqE30_Z3aIxHdLQ__EtyouBM'

export const deliverySupabase = createClient(
  deliverySupabaseUrl,
  deliverySupabasePublishableKey,
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  }
)
