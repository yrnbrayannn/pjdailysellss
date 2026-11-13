# PJ's Stock & Sales

A simple mobile-first PWA for the restaurant: orders, butchery, stock, expenses and the cashier handover.

**Stack:** React + Vite, React Router, Tailwind CSS, `supabase-js`. State is plain `useState` / `useEffect`.
All database and storage calls live in `src/lib/api.ts` (pages also call `supabase` directly for one-off queries).

## 1. Set up Supabase (once)

1. Open your **STOCK&SALES** project → **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
   It is safe to run again and keeps existing data. It creates the new tables, roles, security rules,
   the audit-log triggers and the private `receipts` storage bucket.
2. **Authentication → Users → Add user** for yourself and each staff member (email + password).
3. In the SQL Editor make yourself admin (the last lines of `schema.sql`):
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
   Everybody else stays `staff` automatically.
4. Recommended: **Authentication → Providers → Email → turn off "Allow new users to sign up"** so only people you add can log in.

## 2. Run it

```sh
cp .env.example .env     # then fill in your project URL + publishable key (Project Settings → API)
npm install
npm run dev              # http://localhost:5173
npm test                 # money, split and reconciliation rules
npm run build            # production build in dist/
```

## 3. Deploy

Any static host works (Cloudflare Pages, Netlify, Vercel). Build command `npm run build`, output `dist`.
`public/_redirects` (Netlify/Cloudflare) and `vercel.json` already send every URL to `index.html`.
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the host's environment settings.
Open the site on a phone and choose **Add to Home screen** to install it.

## How it works

| Who | Sees |
| --- | --- |
| **Staff** | Orders, Butchery, Stock (count / delivery / transfer / wastage / issue), Expenses. Only their own entries. |
| **Admin** | Everything, plus Dashboard, Menu, Suppliers and Audit log. |

* The header **date + Day/Night** controls every list and every save.
* **Split payments:** Cash + M-Pesa needs an M-Pesa amount; cash is always `total − M-Pesa`
  (enforced in the form, tested, and by a database check).
* **Reconciliation** (per counted item): `opening + deliveries + transfers in − transfers out − wastage − closing`
  = units used → × menu price = *expected sales*, compared with the orders entered (*actual sales*).
  A gap bigger than the threshold (default KSh 500, editable on the dashboard) is flagged for **Investigate / Approve**.
  Opening is pre-filled from the previous closing count and can be edited.
* **Cashier handover:** Total Sales, Cash, M-Pesa, Unpaid, Expenses and *Cash to hand over*
  (= total cash − expenses paid from cash).
* **Audit log:** a database trigger records every edit and delete (who, what, when). Admin reads it under More → Audit log.
* **Receipt photos:** attached on Expenses and the Issue form; stored privately in Supabase Storage and opened with short-lived links.

## Notes

* Stock and reconciliation match items **by name**. If you rename a menu item, history under the old name will not match.
* The app needs internet to save. The service worker only makes it installable and opens the screen offline.
* Never put a `service_role` key in `.env`; only the publishable/anon key belongs in the browser.
