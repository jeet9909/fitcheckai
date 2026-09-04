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

-- description / image_urls: added for the curate-product Edge Function
-- (manual product-detail curation — description, an image gallery, size
-- chart — mirroring curate-match's "manual curation, not scraping" pattern,
-- since a real live-scraping test against Myntra/AJIO/Meesho confirmed the
-- block on this data is network/IP-level bot-management, not something a
-- header tweak or parser fix can work around; see supabase/README.md).
-- `image_urls` is a gallery *in addition to* the existing single `image_url`
-- column above, which stays exactly as-is (every existing read path already
-- depends on it) — `image_urls` is additive, never a replacement.
--
-- Why these two new columns (and the already-existing `material`/
-- `size_chart` columns above) are safe from being silently overwritten by a
-- future re-scrape: search-products/persistCatalog.ts's `upsertListings` is
-- the only code path that upserts scraped/affiliate rows into `products`,
-- and its upsert payload is a fixed, explicit column list — name, brand,
-- store, category, price, mrp, color, product_url, image_url, source,
-- scraped_at — full stop. PostgREST's upsert-on-conflict (`onConflict:
-- 'product_url'`) only ever updates columns actually present in the
-- payload; any column not named there (material, size_chart, and now
-- description, image_urls) is left completely untouched by a re-scrape of
-- the same product_url. This is the same guarantee `material` has already
-- relied on since it was added — extended here, explicitly, so a future
-- reader doesn't have to re-derive it by diffing persistCatalog.ts by hand.
alter table products add column description text not null default '';
alter table products add column image_urls text[] not null default '{}';

alter table products enable row level security;

create policy "products: public read" on products
  for select using (true);

-- Only the service role (used by the fetch-product Edge Function and the
-- curate-product Edge Function) can write. No policy is created for
-- insert/update/delete, so RLS denies them to the anon/authenticated roles
-- by default; the service role bypasses RLS entirely.

-- ---------------------------------------------------------------------------
-- product_match_groups / product_match_members: manual cross-store price-
-- comparison curation (Phase 2). Deliberately NOT automated similarity
-- matching — title/image-similarity scoring across stores was evaluated and
-- rejected as unreliable for this catalog: a false match (silently showing
-- two different products as "the same item, cheaper elsewhere") is actively
-- misleading, worse than showing no comparison at all (see D-014: never
-- present data as more/less trustworthy than it actually is). A group only
-- ever contains product ids a human curator explicitly submitted via the
-- curate-match Edge Function — nothing in this schema or that function
-- computes or suggests which ids belong together.
-- ---------------------------------------------------------------------------
create table product_match_groups (
  id bigint generated always as identity primary key,
  label text not null,          -- human-readable, e.g. "Levi's 511 Slim Jeans, Indigo"
  created_by text not null,     -- curator identity/email for accountability
  created_at timestamptz not null default now()
);

-- One row per (group, product) membership. A product may belong to at most
-- one group, period — enforced here at the DB level via `product_id`'s own
-- `unique` constraint (not just the old composite PK on
-- (match_group_id, product_id), which only stopped a product appearing
-- twice *in the same group* and did nothing to stop it appearing under two
-- *different* groups). This closes a real TOCTOU race: curate-match's
-- application-layer "already in another group" pre-check
-- (createMatchGroup in functions/curate-match/matchGroups.ts) does a SELECT
-- before the INSERT, but two concurrent requests with an overlapping
-- productId could both pass that check before either INSERT lands, without
-- a DB-level constraint tying the check to the write. `product_id unique`
-- makes that impossible regardless of request timing/ordering — the second
-- concurrent INSERT now fails with a real unique-violation (Postgres error
-- 23505), which matchGroups.ts handles as the authoritative guard (the
-- pre-check remains only as a fast-path for a clean error message in the
-- common, non-racing case). `product_id` alone is now the primary key in
-- all but name; kept as a plain `unique` column (rather than promoting it
-- to the primary key) so the table's identity story stays
-- (match_group_id, product_id) for anyone joining on it, while still
-- guaranteeing one-group-per-product at the DB level.
create table product_match_members (
  match_group_id bigint not null references product_match_groups(id) on delete cascade,
  product_id bigint not null unique references products(id) on delete cascade,
  primary key (match_group_id, product_id)
);

alter table product_match_groups enable row level security;
alter table product_match_members enable row level security;

create policy "product_match_groups: public read" on product_match_groups
  for select using (true);

create policy "product_match_members: public read" on product_match_members
  for select using (true);

-- Only the service role (used by the curate-match Edge Function) can write.
-- No policy is created for insert/update/delete, so RLS denies them to the
-- anon/authenticated roles by default; the service role bypasses RLS
-- entirely — matching products' own write model above.

-- created_by is a curator's internal identity (e.g. an email), recorded
-- purely for internal accountability -- it was never meant to be part of
-- the public-facing "is this really the same product elsewhere?" data the
-- "public read" policy above exists to expose. RLS policies are row-level
-- only (they can't restrict which *columns* of an allowed row are
-- readable), so without column-level privileges, any holder of the anon
-- key (i.e. anyone -- the anon key ships in the client bundle) could read
-- every curator's email straight out of the REST API
-- (.../product_match_groups?select=created_by), even though the app's own
-- frontend query (fetchMatchGroup in src/lib/api.ts) never asks for that
-- column.
--
-- IMPORTANT, verified against the live project 2026-09-03: a bare
-- `revoke select (created_by) on ... from anon, authenticated` here looks
-- correct and produces no error, but is a NO-OP against Supabase's
-- defaults -- Postgres grants new tables full table-level SELECT to
-- anon/authenticated automatically, and a table-level grant makes every
-- column readable regardless of any column-level revoke layered on top
-- (a column-level privilege can only ADD access beyond a narrower
-- table-level grant, never narrow a broader one -- confirmed via
-- `has_column_privilege`/`pg_attribute.attacl` directly against the live
-- DB, not just by reading this file). The only way to actually restrict
-- which columns anon/authenticated can read is to revoke the table-level
-- grant entirely and re-grant SELECT on just the columns meant to be
-- public:
revoke select on product_match_groups from anon, authenticated;
grant select (id, label, created_at) on product_match_groups to anon, authenticated;
-- service_role (used by curate-match) is untouched by the above -- it
-- bypasses RLS and privilege checks entirely, same as every other table.
-- One consequence worth knowing: `select=*` (star) against this table now
-- 401s for anon/authenticated, since `*` expands to every column
-- including the restricted one and Postgres denies the whole request if
-- any requested column lacks privilege -- not a bug, just how column
-- privileges compose. Confirmed this doesn't affect the app: nothing in
-- src/ queries product_match_groups directly (fetchMatchGroup only reads
-- product_match_members and products); if that ever changes, the query
-- must name columns explicitly (id, label, created_at), never `*`.

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
