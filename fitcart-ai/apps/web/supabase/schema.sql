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
  source text not null default 'curated',
  -- Free-text; observed values as of the 6-store search-products revision:
  --   'curated' | 'scraped'
  --   | 'amazon-affiliate'   | 'flipkart-affiliate'
  --   | 'amazon-mock'        | 'flipkart-mock'
  --   | 'amazon-scraped'     | 'flipkart-scraped'
  --   | 'meesho-mock'        | 'meesho-scraped'
  --   | 'myntra-mock'        | 'myntra-scraped'
  --   | 'ajio-mock'          | 'ajio-scraped'
  --   | 'nykaaFashion-mock'  | 'nykaaFashion-scraped'
  -- Meesho/Myntra/AJIO/Nykaa Fashion NEVER produce a '-affiliate' suffix —
  -- unlike Amazon/Flipkart, there is no public catalog/search API for these
  -- four stores at all (see supabase/functions/search-products/
  -- orchestrator.ts's PROVIDERS table, where configured() is hardcoded to
  -- always return false for all four), so every real row for them comes
  -- either from the scraping fallback ('<store>-scraped') or from
  -- fetch-product's single-URL paste flow (plain 'scraped').
  -- '*-mock' rows are written only when the search-products Edge Function's
  -- MOCK_MARKETPLACES dev/demo flag is on (see supabase/functions/search-
  -- products/mockData.ts) — this reuses the existing free-text column
  -- rather than a schema migration, so there is no structural (FK/enum)
  -- separation between real and mock rows beyond this string. Never enable
  -- MOCK_MARKETPLACES on a production project.
  -- '*-scraped' rows (distinct from the plain 'scraped' value used by the
  -- fetch-product paste-a-link flow) come from search-products' scraping
  -- fallback (supabase/functions/search-products/scraping/) — used only
  -- when that store's real affiliate API isn't configured (permanently true
  -- for the four non-Amazon/Flipkart stores). Unlike mock rows, these point
  -- at real, allowlist-checked store URLs pulled from a live page, so
  -- they're persisted as ordinary catalog data.
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
