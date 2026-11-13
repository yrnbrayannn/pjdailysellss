-- =====================================================================
-- PJ's Stock & Sales — database setup
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once. It keeps your existing data.
-- =====================================================================

-- ---------- 0. Enums (only created if missing) ----------
do $$ begin create type public.shift_enum as enum ('Day', 'Night');
exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method_enum as enum ('Cash', 'M-Pesa', 'Cash + M-Pesa', 'Unpaid', 'Owner', 'Internal Transfer');
exception when duplicate_object then null; end $$;
do $$ begin create type public.check_status_enum as enum ('OK', 'FILL IN MISSING', 'CHECK SPLIT', 'UNPAID', 'CHECK PRICE');
exception when duplicate_object then null; end $$;

-- ---------- 1. Core tables (created only if missing, then extended) ----------
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text not null,
  selling_price numeric not null,
  unit_type text,
  created_at timestamptz not null default now()
);
alter table public.menu_items add column if not exists track_stock boolean not null default true;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  products text,
  created_at timestamptz not null default now()
);

create table if not exists public.hotel_sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  shift public.shift_enum not null,
  food_item text not null,
  order_type text,
  total_cost numeric not null,
  payment_method public.payment_method_enum not null,
  mpesa_part numeric default 0,
  cash_received numeric,
  mpesa_received numeric,
  table_no text,
  notes text,
  check_status public.check_status_enum default 'OK',
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.hotel_sales add column if not exists quantity numeric not null default 1;
alter table public.hotel_sales add column if not exists unit_price numeric;

create table if not exists public.butchery_sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  shift public.shift_enum not null,
  meat_item text not null,
  quantity_kg numeric not null,
  price_per_kg numeric not null,
  cost_kshs numeric not null,
  payment_method public.payment_method_enum not null,
  check_status public.check_status_enum default 'OK',
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  shift public.shift_enum not null,
  description text not null,
  amount numeric not null,
  paid_from public.payment_method_enum not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.expenses add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.expenses add column if not exists receipt_url text;

-- Record who created each row automatically
alter table public.hotel_sales    alter column created_by set default auth.uid();
alter table public.butchery_sales alter column created_by set default auth.uid();
alter table public.expenses       alter column created_by set default auth.uid();

-- Split payments must add up: cash + M-Pesa = total (applies to NEW rows only)
alter table public.hotel_sales drop constraint if exists hotel_sales_split_ok;
alter table public.hotel_sales add constraint hotel_sales_split_ok check (
  payment_method <> 'Cash + M-Pesa'
  or abs(coalesce(cash_received, 0) + coalesce(mpesa_part, 0) - total_cost) < 0.01
) not valid;

-- ---------- 2. New tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_takes (
  id uuid primary key default gen_random_uuid(),
  stock_date date not null,
  shift public.shift_enum not null,
  item_name text not null,
  opening_qty numeric not null default 0,
  closing_qty numeric not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (stock_date, shift, item_name)
);

create table if not exists public.stock_additions (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  shift public.shift_enum not null,
  item_name text not null,
  quantity numeric not null check (quantity > 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  shift public.shift_enum not null,
  item_name text not null,
  quantity numeric not null check (quantity > 0),
  direction text not null default 'Out' check (direction in ('Out', 'In')),
  location text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.wastage (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  shift public.shift_enum not null,
  item_name text not null,
  quantity numeric not null check (quantity > 0),
  reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.discrepancies (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  shift public.shift_enum not null,
  item_name text not null,
  expected_amount numeric,
  actual_amount numeric,
  amount numeric not null,
  note text,
  receipt_url text,
  status text not null default 'Open' check (status in ('Open', 'Investigate', 'Approved')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null,
  changed_by uuid,
  changed_by_email text,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);

-- ---------- 3. Profiles: every new login gets a "staff" profile ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create profiles for people who already have logins
insert into public.profiles (id, email) select id, email from auth.users on conflict (id) do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- ---------- 4. Audit log: who changed or deleted what, and when ----------
create or replace function public.log_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mail text;
begin
  select email into mail from public.profiles where id = uid;
  if tg_op = 'DELETE' then
    insert into public.audit_logs (table_name, record_id, action, changed_by, changed_by_email, old_data)
    values (tg_table_name, to_jsonb(old) ->> 'id', 'DELETE', uid, mail, to_jsonb(old));
    return old;
  end if;
  if to_jsonb(old) = to_jsonb(new) then return new; end if;  -- nothing really changed
  insert into public.audit_logs (table_name, record_id, action, changed_by, changed_by_email, old_data, new_data)
  values (tg_table_name, to_jsonb(new) ->> 'id', 'UPDATE', uid, mail, to_jsonb(old), to_jsonb(new));
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['menu_items','suppliers','hotel_sales','butchery_sales','expenses',
    'stock_takes','stock_additions','stock_transfers','wastage','discrepancies','profiles'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format('create trigger audit_%1$s after update or delete on public.%1$I for each row execute function public.log_audit()', t);
  end loop;
end $$;

-- ---------- 5. Row Level Security (who can see / change what) ----------
-- Remove any older policies on these tables so only the rules below apply.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('menu_items','suppliers','hotel_sales','butchery_sales','expenses',
      'profiles','stock_takes','stock_additions','stock_transfers','wastage','discrepancies','audit_logs') loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['menu_items','suppliers','hotel_sales','butchery_sales','expenses','profiles',
    'stock_takes','stock_additions','stock_transfers','wastage','discrepancies','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Staff: add entries, see and delete only their OWN entries. Admin: everything.
do $$
declare t text;
begin
  foreach t in array array['hotel_sales','butchery_sales','expenses','stock_additions','stock_transfers','wastage','discrepancies'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin() or created_by = auth.uid())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (created_by = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin() or created_by = auth.uid())', t || '_delete', t);
  end loop;
end $$;

-- Menu & suppliers: everyone signed in can read, only admin can change.
create policy menu_items_read  on public.menu_items for select to authenticated using (true);
create policy menu_items_admin on public.menu_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy suppliers_read   on public.suppliers  for select to authenticated using (true);
create policy suppliers_admin  on public.suppliers  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Stock counts are shared by everyone on the shift.
create policy stock_takes_read   on public.stock_takes for select to authenticated using (true);
create policy stock_takes_insert on public.stock_takes for insert to authenticated with check (true);
create policy stock_takes_update on public.stock_takes for update to authenticated using (true) with check (true);
create policy stock_takes_delete on public.stock_takes for delete to authenticated using (public.is_admin());

-- Profiles: read your own, admin reads and edits all.
create policy profiles_read   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Audit log: admin can read; nobody can write directly (the trigger does it).
create policy audit_logs_read on public.audit_logs for select to authenticated using (public.is_admin());

-- ---------- 6. Storage bucket for receipt photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists receipts_upload on storage.objects;
drop policy if exists receipts_read on storage.objects;
-- Files are saved under <user id>/<file>. You can upload to your own folder; admin can see everything.
create policy receipts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- 7. MAKE YOURSELF ADMIN ----------
-- 1) Create your login in Supabase → Authentication → Users → "Add user".
-- 2) Put your email below, remove the two dashes at the start of the line, and run it:
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';
