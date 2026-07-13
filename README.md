
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

## Production (Vercel + Render)

### Step 1 — Supabase (once)

Run `supabase/manual/full_schema_setup.sql` in Supabase SQL Editor (project `wgpqpfypcaicdjbkhdey`).

### Step 2 — Render backend (free)

1. Go to [dashboard.render.com](https://dashboard.render.com) → sign up with GitHub.
2. **New +** → **Blueprint** → connect repo **`Tarun910/namdev_connect`**.
3. Render reads `render.yaml` — confirm service **namdev-connect-api**, plan **Free**.
4. When prompted, paste these **Environment Variables**:

| Key | Value |
|-----|--------|
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...` (same as Vercel) |
| `CLERK_SECRET_KEY` | `sk_test_...` |
| `SUPABASE_URL` | `https://wgpqpfypcaicdjbkhdey.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` |

5. Click **Apply** / deploy. Wait until status is **Live**.
6. Open `https://namdev-connect-api.onrender.com/api/health` → must show `{"ok":true}`.
   - If Render gave a different URL, update `vercel.json` rewrite `destination` to match.

**Manual deploy (no Blueprint):** New → Web Service → repo root → Runtime **Node** → Build: `npm install && npm run build -w backend` → Start: `npm run start -w backend` → Health: `/api/health` → Free.

Free tier sleeps after **15 min** idle; first API call after that can take ~1 min.

### Step 3 — Vercel frontend

**Environment Variables** (Settings → Environment Variables):

| Variable | Value |
|----------|--------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `VITE_SUPABASE_URL` | `https://wgpqpfypcaicdjbkhdey.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key |
| `VITE_API_BASE_URL` | `https://namdev-connect-api.onrender.com` (**required** — no `/api` suffix) |

Redeploy Vercel after env changes.

### Step 4 — Clerk

Clerk Dashboard → **Configure → Domains** → add your Vercel URL (`https://*.vercel.app` or exact production URL).

### Verify

1. Sign in on production Vercel site.
2. Tap **Profile** → should load (not `cloud_off` / Failed to fetch).
3. If slow first time after idle, wait ~1 min and tap **Retry** (Render waking up).
