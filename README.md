# YORA | AI Negotiation Coach (永睿 AI 谈判教练)

AI-powered negotiation co-pilot for Indonesian SME importers dealing directly with Chinese suppliers. Helps buyers translate, interpret, and respond to supplier messages with cultural context (Guanxi), while tracking relationship strength and negotiation strategy per supplier.

## Key Features

- **Supplier Profiles** — track WeChat contact, pricing thresholds (target / walk-away / current), MOQ, and negotiation goals per supplier.
- **AI Chat Analysis** — paste a supplier's WeChat message and get: translation, real meaning (cultural subtext), tone/guanxi read, a copy-ready reply, and a suggested next move.
- **Guanxi Meter** — tracks relationship trust/leverage/urgency scores per supplier over time, computed from AI-analyzed conversation history.
- **Phrase Library** — categorized Mandarin negotiation phrases with pinyin and usage context.
- **Cultural Guide** — reference material on Chinese business etiquette relevant to negotiation.
- **PDF Export** — generates a branded, shareable negotiation transcript (summary + full chat log) for a supplier.
- **Admin Dashboard** — usage stats gated behind a single admin email (env-configured).

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS |
| Backend | Express (TypeScript), deployed as a Vercel serverless function |
| Database / Auth / Storage | Supabase (Postgres + Row Level Security, Auth incl. Google OAuth, Storage) |
| AI | Google Gemini (`@google/genai`) |
| Other integrations | Google Sheets API (signup/lead logging) |

## Architecture Notes

- `server.ts` exports `buildApp()`, an async factory that returns a fully configured Express app **without** calling `.listen()`. This lets the same app be reused by:
  - `api/index.ts` — the Vercel serverless entry point (all `/api/*` requests are rewritten here per `vercel.json`).
  - `startServer()` (also in `server.ts`) — a traditional persistent-server entry point for local dev or non-Vercel hosts (Render, Koyeb, etc). This only auto-runs when `process.env.VERCEL` is not set.
- All backend routes live under `/api/*`. Static frontend assets are served natively by Vercel from the Vite build output (`dist/`) — the function is only invoked for API calls.
- Auth, database access, and file storage all go through Supabase. The server uses the **service role key** (bypasses Row Level Security) for a small number of endpoints (admin stats, persisting AI chat replies) and manually re-checks resource ownership in those cases since RLS isn't enforced automatically for that client.
- AI chat replies are persisted to the database **server-side**, immediately after the Gemini response comes back — not client-side after the fetch resolves. This means a conversation's AI reply and updated Guanxi scores are saved even if the user has already navigated away from the Negotiation Room tab. The frontend picks up new messages via a Supabase Realtime subscription on `chat_messages`.

## Getting Started

### 1. Prerequisites
- Node.js 18+ (or Bun)
- A [Supabase](https://supabase.com) project
- A [Google Gemini API key](https://aistudio.google.com)
- (Optional) A Google Cloud service account with Sheets API access, for signup logging

### 2. Install dependencies
```bash
npm install
# or: bun install
```

### 3. Set up the database
In your Supabase project's **SQL Editor**, run, in order:
1. `supabase_schema.sql` — creates all tables (`profiles`, `suppliers`, `chat_messages`, `admins`) and their Row Level Security policies.
2. `supabase_seed.sql` — inserts your admin user's email into the `admins` table (edit the placeholder email before running).

If your database already existed before a given schema change, check for any `RUN_THIS_IN_*.sql` migration files in the repo history and apply them too — `supabase_schema.sql` only affects fresh databases, it does not retroactively alter existing tables.

### 4. Configure environment variables
Copy `.env.example` to `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (`anon` `public` key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (`service_role` key) — **server-side only, never commit or expose to the client** |
| `VITE_ADMIN_EMAIL` / `ADMIN_EMAIL` | Your own email — gates access to `/api/admin/users` and the in-app admin dashboard |
| `GOOGLE_SHEET_ID` | The ID in your Google Sheet's URL, between `/d/` and `/edit` |
| `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` | From a Google Cloud service account JSON key (Sheets API enabled, and the sheet shared with this service account email as Editor) |

### 5. Enable Google Sign-In (optional but recommended)
1. Supabase → Authentication → Providers → Google → enable, and copy the callback URL shown.
2. Google Cloud Console → APIs & Services → Credentials → create an OAuth Client ID (Web application) → add the Supabase callback URL as an Authorized redirect URI.
3. Paste the resulting Client ID/Secret back into the Supabase Google provider settings.
4. Supabase → Authentication → URL Configuration → set **Site URL** and **Redirect URLs** to your actual deployed domain (not `localhost`, unless you're testing locally).

### 6. Run locally
```bash
npm run dev
```

### 7. Deploy
Deployed on [Vercel](https://vercel.com) by default (see `vercel.json`). Set all env vars above in the Vercel project's **Settings → Environment Variables**, scoped to **Production** (and Preview/Development if you use those). Also set **Settings → Functions → Max Duration** to accommodate longer Gemini responses (60s is generally sufficient).

For non-Vercel hosts (Render, Koyeb, a VPS, etc), use `npm run build && npm start` instead — this runs the traditional persistent-server path.

## Project Structure

```
├── api/
│   └── index.ts          # Vercel serverless entry point
├── server.ts              # Express app + all /api/* route handlers
├── src/
│   ├── components/        # Screen-level React components
│   ├── lib/
│   │   ├── supabase.ts    # Supabase client + storage URL helper
│   │   └── SupabaseContext.tsx  # Auth/profile context + realtime subscriptions
│   ├── App.tsx             # Top-level routing/state, Supabase CRUD for suppliers
│   └── types.ts
├── supabase_schema.sql    # Full DB schema + RLS policies
├── supabase_seed.sql      # Admin user seed
└── vercel.json
```

## Known Limitations

- The `chat_messages` and `suppliers` writes on the server use the Supabase **service role** client, with ownership checked manually in code rather than via RLS. Any new server route that writes to these tables needs the same manual ownership check.
- Parsing of the AI's structured response (translation / real meaning / suggested reply / scores) is duplicated between `server.ts` and `NegotiationRoomScreen.tsx` (kept in sync manually) since the server needs it to persist messages, and the client needs it to render immediately without waiting on Realtime. If the AI system prompt's output format changes, both copies need updating.

## License

Private/proprietary — part of the YORA product suite.
