# Voyeur Members App

Real, deployable version of the members portal — connects to Supabase for
auth, database, and photo storage, and sends real emails via Resend.

## What's already done for you
- `.env` is filled in with your real Supabase URL and anon key
- All the React code (login, profile, admin panel) is written and wired to Supabase
- Three server-side functions are written (in `supabase/functions/`) — these
  handle the parts that need to stay secret: sending real email, creating
  member logins, and fetching a member's own photos securely

## What you still need to do

### 1. Install Node.js (if you don't have it)
Download from https://nodejs.org (the "LTS" version). This lets you run the
project locally and deploy it.

### 2. Install the project's dependencies
Open a terminal in this folder and run:
```
npm install
```

### 3. Try it locally
```
npm run dev
```
This prints a local URL (like `http://localhost:5173`) — open it in your
browser. Login won't fully work yet until you finish steps 4–6 below, but you
can confirm it loads.

### 4. Install the Supabase CLI and deploy the Edge Functions
The three functions in `supabase/functions/` need to be deployed to Supabase
itself (not Netlify) — they run on Supabase's servers so secrets stay safe.

```
npm install -g supabase
supabase login
supabase link --project-ref lmopfcntexvepdzijdmu
supabase functions deploy send-photo-email
supabase functions deploy create-member
supabase functions deploy get-member-photos
```

### 5. Set your Resend API key as a Supabase secret
This is what lets `send-photo-email` actually send real email without the
key ever touching browser code:
```
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

**Important:** the email function currently sends from
`onboarding@resend.dev`, which is Resend's shared test address — real
emails will go out, but for a professional look you'll eventually want to
verify your own domain in Resend and change that "from" address in
`supabase/functions/send-photo-email/index.ts`.

### 6. Create your first staff account (if you haven't already)
In the Supabase dashboard: Authentication → Users → Add user (your real
email + a password). Copy that user's ID, then in the SQL Editor run:
```sql
insert into staff (id) values ('paste-your-user-id-here');
```

### 7. Deploy to Netlify
The easiest path:
1. Push this whole folder to a GitHub repository
2. In Netlify: "Add new site" → "Import an existing project" → connect that
   repo
3. Netlify will detect the build settings automatically from `netlify.toml`
4. Before deploying, add your environment variables: Site settings →
   Environment variables → add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` with the same values from your local `.env`
5. Deploy

Once deployed, log in as staff, add a few real members and events, and try
tagging a photo to confirm the real email arrives.

## Notes on how login works now
- **Members and staff both use the same real login screen** — the app
  checks Supabase to see if that account is a member, staff, or both, and
  shows the right view automatically.
- **Password reset is now real** — it uses Supabase's built-in email flow
  instead of the simulated on-screen code from the earlier prototype. For
  this to actually send emails reliably (not just Supabase's very limited
  free testing email), configure a custom SMTP provider (Resend supports
  this) under Supabase Dashboard → Authentication → Email Templates / SMTP
  settings.
- **Photos are stored securely** — real files go into Supabase Storage, and
  members can only ever see photos tagged to them (enforced by the
  `get-member-photos` function, which double-checks their identity
  server-side before generating any download link).
