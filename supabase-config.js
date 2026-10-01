// Supabase project credentials.
// The anon key is safe to expose in frontend code — data protection is
// enforced by Row Level Security policies in Supabase, not by this key.
// NEVER put the service_role key in this file.
const SUPABASE_URL = 'https://xshtbenschnhszerlonf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzaHRiZW5zY2huaHN6ZXJsb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NDUxNzQsImV4cCI6MjEwNjQyMTE3NH0.uWcmStgfLwswAh6-QUkWyawr_5tGjRxdFOiwKeE1Q5c';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
