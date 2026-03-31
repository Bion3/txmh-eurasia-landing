import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hcorkkudgicarsmexnqf.supabase.co' // 替换为您的真实 URL
const supabaseAnonKey = 'sb_publishable_nB2eShVqNNkND-zOSHYSnQ_Pf2xtBgp' // 替换为您的真实 Key

export const supabase = createClient(supabaseUrl, supabaseAnonKey)