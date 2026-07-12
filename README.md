
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

## Production (Vercel + Railway)

**Frontend (Vercel)** — set only `VITE_*` vars:

| Variable | Value |
|----------|--------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `VITE_SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

Leave `VITE_API_BASE_URL` **unset** on Vercel — `vercel.json` proxies `/api/*` to Railway.

**Backend (Railway)** — required env:

| Variable | Value |
|----------|--------|
| `CLERK_PUBLISHABLE_KEY` | Same as frontend |
| `CLERK_SECRET_KEY` | Clerk secret |
| `SUPABASE_URL` | `https://wgpqpfypcaicdjbkhdey.supabase.co` (your project) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key |
| `PORT` | `5000` (Railway sets this automatically) |

Deploy backend from repo root (`railway.toml` runs `npm run build -w backend`). After deploy, open `https://YOUR-RAILWAY-URL/api/health` — must return `{"ok":true}`. Update the Railway URL in root `vercel.json` under `rewrites` if it changed.

Run `supabase/manual/full_schema_setup.sql` in Supabase SQL Editor before first sign-in.

### Backend hosting (Railway trial expired?)

**Railway** after trial → **Free plan** ($1 credit/month). Deployments pause when trial ends — open Railway → your service → **Redeploy** (no card needed if you stay on Free). If it asks to upgrade, you can use **Render** instead (see `render.yaml`).

**Render (free alternative):**

1. [render.com](https://render.com) → **New Web Service** → connect GitHub repo
2. Render detects `render.yaml` — choose **Free** instance
3. Add env vars: `CLERK_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy → copy URL (e.g. `https://namdev-connect-api.onrender.com`)
5. Update root `vercel.json` rewrite destination to that URL + redeploy Vercel

Free Render sleeps after 15 min idle (first request ~1 min slow). Railway Free has similar limits ($1/month cap).
