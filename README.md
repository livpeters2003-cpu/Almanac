# Almanac

A yearly planner for your phone and computer: calendars, workouts, holidays, repeating events and a daily news brief, synced through your own account.

## Run it locally

```
npm install
npm run dev
```

## Setup

1. In Supabase, open the SQL editor and run `supabase/migrations/001_initial.sql`.
2. In Supabase, under Authentication → Email Templates → Magic Link, add `{{ .Token }}` to the email so people can sign in with a 6-digit code (needed for iPhone home-screen apps).
3. Import this repo into Vercel (framework: Vite). No environment variables are required; `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` override the defaults in `src/config.js`.
4. In Supabase, under Authentication → URL Configuration, set the Site URL and a redirect URL to your Vercel address.
