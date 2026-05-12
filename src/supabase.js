import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://idgczlqrrfcfwztfdrjj.supabase.co'
const supabaseKey = 'sb_publishable_k88OEJ2d2PTcxwVLqHXrVA_b4UGy1-p' // Kullanıcının ilettiği key

export const supabase = createClient(supabaseUrl, supabaseKey)
