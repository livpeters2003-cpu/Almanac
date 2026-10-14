// Public Supabase settings. The anon key is designed to be public: row level
// security in the database decides what each signed-in person can read or write.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hhusayxsiwizjhbsifgp.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhodXNheXhzaXdpempoYnNpZmdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTQxNTEsImV4cCI6MjEwNzU3MDE1MX0.RMAXGnskO6lUGAQEzpV7d15ut51h1HQvQSWtxfc_590';
