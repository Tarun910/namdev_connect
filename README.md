
# Namdev Connect

## Project layout

- **`frontend/`** — Vite + React; **Clerk** handles sign-in (`@clerk/react` v6). The UI calls your API with Clerk’s session token (you don’t configure Supabase Auth).
- **`backend/`** — Express + **`@clerk/express`** to verify requests; **Supabase service role** reads/writes Postgres (server-side only).
- **`supabase/migrations/`** — SQL: `001` creates tables; **`002_clerk_auth.sql`** switches profiles to **Clerk** (adds `clerk_user_id`, removes Supabase Auth coupling).

## Clerk setup

1. Create an application at [https://dashboard.clerk.com](https://dashboard.clerk.com).
2. Under **API Keys**, copy the **Publishable key** and **Secret key**.
3. **Configure → Paths** (or **Domains**): allow `http://localhost:3000` for local dev.
4. **`frontend/.env.local`**
   - `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`
5. **`backend/.env.local`**
   - `CLERK_SECRET_KEY=sk_test_...`
   - `SUPABASE_URL=https://YOUR_REF.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=...` (**service_role**, never expose to the browser)
   - `PORT=5000` (optional)

Restart `npm run dev` after changing env files.

## Supabase setup

1. Run **`supabase/migrations/001_initial_schema.sql`** in the SQL Editor (if you haven’t already).
2. Run **`supabase/migrations/002_clerk_auth.sql`** so `profiles` can store **`clerk_user_id`** and foreign keys point at `profiles(id)` instead of `auth.users`.
3. **Project Settings → API** → copy **Project URL** and the **service_role** key (backend only).

The first time a user signs in with Clerk, the API creates their `profiles` row and seeds notifications.

## Run locally

```bash
npm install
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)  
- API: [http://localhost:5000](http://localhost:5000)

If `VITE_CLERK_PUBLISHABLE_KEY` is missing, the app shows a short setup screen instead of crashing.
