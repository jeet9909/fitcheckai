-- FitCart AI — Supabase schema.
--
-- Paste this whole file into the Supabase SQL editor for a fresh project
-- (Dashboard → SQL Editor → New query → run). Replaces the old single-tenant
-- Cloudflare D1 schema (fitcart-ai/apps/web/db/schema.sql, now legacy/unused)
-- with a multi-user schema backed by Supabase Auth.

-- ---------------------------------------------------------------------------
-- profiles: app-level row per authenticated user. auth.users holds the real
-- credentials (email/password or Google OAuth); this just mirrors the bits
-- the app UI needs to read/display.
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: read own" on profiles
  for select using (auth.uid() = id);

create policy "profiles: update own" on profiles
  for update using (auth.uid() = id);

-- Auto-create a profiles row whenever a new auth.users row appears (signup
-- via email/password or Google OAuth both trigger this).
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- products: the real catalog, filled by the fetch-product Edge Function
-- (scraped) or curated by hand. Field names mirror the frontend Product type
-- in src/data/products.ts.
-- ---------------------------------------------------------------------------
create table products (
  id bigint generated always as identity primary key,
  name text not null,
  brand text not null,
  store text not null,
  category text not null,
  bucket text not null default 'Clothing',
  slot text not null default 'top',
  price integer not null,
  mrp integer not null,
  color text not null default '',
  material text not null default '',
  fit_score integer not null default 80,
  confidence integer not null default 75,
  breakdown jsonb not null default '[]',
  product_url text unique,
  image_url text,
  size_chart jsonb,
  source text not null default 'curated', -- 'curated' | 'scraped'
  scraped_at timestamptz
);

alter table products enable row level security;

create policy "products: public read" on products
  for select using (true);

-- Only the service role (used by the fetch-product Edge Function) can write.
-- No policy is created for insert/update/delete, so RLS denies them to the
-- anon/authenticated roles by default; the service role bypasses RLS entirely.

-- ---------------------------------------------------------------------------
-- saved_looks: user-scoped "My Looks" — replaces the old single-tenant
-- saved_products table. product_id references the real catalog above, but
-- is nullable so a saved render from a pasted link that never resolved to a
-- catalog row can still be saved.
-- ---------------------------------------------------------------------------
create table saved_looks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint references products(id) on delete set null,
  render_url text,
  verdict jsonb,
  created_at timestamptz not null default now()
);

alter table saved_looks enable row level security;

create policy "saved_looks: read own" on saved_looks
  for select using (auth.uid() = user_id);

create policy "saved_looks: insert own" on saved_looks
  for insert with check (auth.uid() = user_id);

create policy "saved_looks: delete own" on saved_looks
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- size_memory: per-brand size notes shown on /saved ("Levi's -> 34/M").
-- ---------------------------------------------------------------------------
create table size_memory (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null,
  size text not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, brand)
);

alter table size_memory enable row level security;

create policy "size_memory: read own" on size_memory
  for select using (auth.uid() = user_id);

create policy "size_memory: upsert own" on size_memory
  for insert with check (auth.uid() = user_id);

create policy "size_memory: update own" on size_memory
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- render_usage: server-side render counter. This is what makes the free-
-- render gate real instead of the trivially-resettable localStorage counter
-- in src/lib/renderGate.ts. 2 free renders/lifetime on the user's own photo;
-- is_demo_body renders (unlimited, near-free) don't count against the quota.
-- ---------------------------------------------------------------------------
create table render_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  rendered_at timestamptz not null default now(),
  is_demo_body boolean not null default false
);

alter table render_usage enable row level security;

create policy "render_usage: read own" on render_usage
  for select using (auth.uid() = user_id);

create policy "render_usage: insert own" on render_usage
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subscriptions: Stripe plan state, updated by the stripe-webhook Edge
-- Function on checkout/subscription events.
-- ---------------------------------------------------------------------------
create table subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  plan text not null, -- 'day' | 'pro' | 'year' (matches PaywallSheet's plan keys)
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

create policy "subscriptions: read own" on subscriptions
  for select using (auth.uid() = user_id);

-- No insert/update policy for authenticated/anon — only the stripe-webhook
-- Edge Function (service role) writes to this table.

-- ---------------------------------------------------------------------------
-- stripe_events: webhook idempotency. Stripe retries deliveries, and without
-- this a retried checkout.session.completed inserts a duplicate subscription.
-- ---------------------------------------------------------------------------
create table stripe_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table stripe_events enable row level security;
-- No policies: only the service role (webhook function) ever touches this.

-- ---------------------------------------------------------------------------
-- body_profiles: one row per capture. Backs the Setup -> Processing -> Result
-- flow. user_id is a real auth.uid() for both signed-in users and anonymous
-- guests (Supabase anonymous auth — see src/state/AuthState.tsx), which is
-- what lets RLS and the render-quota check treat guests and members
-- uniformly. The photo lives in the `user-photos` storage bucket below;
-- this row only stores its path. `expires_at` backs the "auto-deleted in
-- 24 hours unless you save it" promise made in Setup.tsx — a scheduled job
-- (see supabase/README.md) deletes rows/objects past this.
-- ---------------------------------------------------------------------------
create table body_profiles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_path text not null,
  height_cm numeric,
  weight_kg numeric,
  consent_photos boolean not null default false,
  consent_sharing boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table body_profiles enable row level security;

create policy "body_profiles: read own" on body_profiles
  for select using (auth.uid() = user_id);

create policy "body_profiles: insert own" on body_profiles
  for insert with check (auth.uid() = user_id);

create policy "body_profiles: update own" on body_profiles
  for update using (auth.uid() = user_id);

create policy "body_profiles: delete own" on body_profiles
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- renders: the real per-user fit result. Previously fit_score/confidence
-- lived as static columns on the shared `products` table, which can't
-- represent "how this fits me" — this table replaces that for the actual
-- try-on flow (products.fit_score/confidence remain as a generic
-- pre-try-on estimate shown in Discover/ProductDetail).
-- ---------------------------------------------------------------------------
create table renders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint references products(id) on delete set null,
  body_profile_id bigint references body_profiles(id) on delete set null,
  status text not null default 'queued', -- 'queued' | 'done' | 'failed'
  render_image_url text,
  size_recommended text,
  headline text,
  detail text,
  region_breakdown jsonb,
  confidence integer,
  error text,
  created_at timestamptz not null default now()
);

alter table renders enable row level security;

create policy "renders: read own" on renders
  for select using (auth.uid() = user_id);

-- No insert/update policy for authenticated/anon — only the create-render
-- Edge Function (service role) writes rows; the client only ever reads.

-- ---------------------------------------------------------------------------
-- user-photos storage bucket: private, per-user-scoped via the folder-name
-- convention {user_id}/{filename} enforced by the RLS policies below
-- (storage.foldername(name)[1] is the first path segment).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('user-photos', 'user-photos', false)
on conflict (id) do nothing;

create policy "user-photos: read own" on storage.objects
  for select using (bucket_id = 'user-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user-photos: insert own" on storage.objects
  for insert with check (bucket_id = 'user-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user-photos: delete own" on storage.objects
  for delete using (bucket_id = 'user-photos' and auth.uid()::text = (storage.foldername(name))[1]);
