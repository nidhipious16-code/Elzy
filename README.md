# Elzy

An internal lead-management CRM, inspired by [Kylas](https://kylas.io/), for teams that sell across several sales teams.

- **Lead capture** from Facebook and Instagram lead ads, WhatsApp, the website, phone calls, and manual entry (walk-ins, referrals), plus CSV import. Duplicate numbers are detected.
- **Automatic assignment** gives each new lead to the available salesperson or call executive with the most spare capacity (open leads ÷ capacity). Team and region are matched, and ties go round-robin.
- **Simple workflow**: New → Picked up / Didn't pick up → Agreed to a demo → Demo booked → Demo done → Converted / Declined. Converted and declined close the lead.
- **Automatic follow-ups** create reminders for each stage. After the maximum number of tries, the manager is alerted. Stale-lead alerts and demo reminders are included too.
- **Roles**: Admin, Sales Manager, Sales Person, Call Executive, Demo Manager. One person can hold several roles. Access is enforced in the database with row-level security.
- **Dashboard** with revenue against target, conversions and the lead funnel. Filters (product, status, region, source, team, person, dates) update the charts.
- **Login** with mobile number + password. Only admins create accounts.
- **Privacy**: consent is recorded per lead, an admin can erase a customer's personal data on request, every change is written to an audit log, and the app sets strict security headers.

Stack: Next.js 15 (App Router, TypeScript, Tailwind) and Supabase (Postgres, Auth, row-level security, pg_cron).

## Run it locally

Requirements: Node 20+ and Docker.

```bash
npm install
npx supabase start            # local Postgres + Auth, applies supabase/migrations
cp .env.example .env.local    # then paste the local URL / anon key / service role key printed by `supabase start`
node --env-file=.env.local scripts/seed-demo.mjs   # optional sample data
npm run dev
```

The sample data creates people with password `Password1`. The mobile numbers are 9000000001 (admin), 9000000002 (manager), 9000000003 (sales), 9000000005 (caller) and 9000000006 (demo manager).

## Deploy

1. **Create a Supabase project.** Pick the Mumbai (ap-south-1) region so customer data stays in India.
2. **Apply the database**: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. **Set up auth** in the Supabase dashboard:
   - Auth → Sign In / Providers: turn **off** "Allow new users to sign up".
   - Auth → Providers → **Phone**: turn on. Supabase asks for an SMS provider. Password sign-in never sends an SMS, so any provider (for example Twilio or Textlocal) works. Real credentials are only needed once OTP login is added.
   - Auth → Providers → **Email**: turn off.
   - Auth → Passwords: minimum length 8, letters and digits.
   - Database → Extensions: make sure **pg_cron** is on. The migration schedules follow-up checks every 15 minutes.
4. **Deploy the app** to Vercel (or any Node host) with the variables from `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` must only be set on the server.
5. **Create the first admin**: `node --env-file=.env.production scripts/create-admin.mjs "Full Name" 98xxxxxxxx 'StrongPass1'`
6. Sign in, then go to **Settings** to add teams, products and regions, and to **Team** to add people.

## Connect lead sources

| Source | How |
|---|---|
| Website | Settings → API keys → create a key. Then POST to `/api/leads/inbound` with header `x-api-key` and JSON `{"name","phone","email","product","region","campaign","message","consent"}`. Call it from your website's server. If the form posts from the browser, list the site in `LEAD_FORM_ALLOWED_ORIGINS`. The empty `website_url` field works as a spam honeypot. |
| Facebook & Instagram lead ads | Create a Meta app and subscribe the Page to `leadgen` with callback `/api/webhooks/meta`. Set `META_APP_SECRET`, `META_VERIFY_TOKEN` and a long-lived `META_PAGE_ACCESS_TOKEN` with `leads_retrieval`. |
| WhatsApp | In the same Meta app, add WhatsApp (Cloud API) and subscribe to `messages` with the same callback. A message from a new number creates a lead. Messages from a known number are added to that lead's history. |
| Phone calls | Call executives use **Add lead** with source "Phone call". A telephony integration is planned for phase 2. |
| Walk-ins / referrals | **Add lead**, or **Import** a CSV. |

## Tests

```bash
# Database rules (assignment, workflow, follow-ups, permissions, privacy) against a scratch Postgres:
PSQL="psql -h localhost -U postgres" supabase/tests/run.sh
npm run lint && npm run build
```

## Security notes

- Every table has row-level security. Salespeople see only their own leads, managers see their team, and demo managers see demo-stage leads. Admins see everything.
- The service-role key is used only in server code (`src/lib/supabase/admin.ts`), after permission checks.
- Failed sign-in gives one generic message, and Supabase rate-limits sign-in attempts. Switched-off accounts are blocked from signing in.
- The audit log records changes to leads, people, roles, targets and API keys. Erasing a customer also scrubs their copies from the audit log.

## Planned for phase 2

OTP login, automatic WhatsApp/SMS follow-up messages, click-to-call with recording, quotations, email sync, AI call summaries, and phone-number masking per role.
