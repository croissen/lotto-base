import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 환경변수가 없습니다. .env.local의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 확인'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
