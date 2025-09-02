import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hciwycbrldbmlylvmrwv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjaXd5Y2JybGRibWx5bHZtcnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzczMTQsImV4cCI6MjA3MjQxMzMxNH0.qxPELJnEvE4PZDsPyBY1ijJQ0HM-5VPPutgOQiljMZY'; // You'll need to replace this

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

export default supabase;